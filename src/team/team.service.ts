import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { StoreGroup } from './entities/store-group.entity';
import { StoreMember } from './entities/store-member.entity';
import { Store } from '../store/entities/store.entity';
import { ActivityService } from './activity.service';
import { AccessError, ALL_PERMISSIONS, normalizePermissions } from './permissions';
import { distinctMemberIds, ownerMemberLimit, setSuspended } from './member-limit';
import { ChangeMemberGroupDto, CreateGroupDto, ImportGroupDto, InviteMemberDto, UpdateGroupDto } from './dto/team.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const err = (Ex: any, code: string, message: string) => new Ex({ code, message });

// a***@gmail.com
export function maskEmail(email: string) {
  const [local, domain] = String(email || '').split('@');
  if (!domain) return '***';
  return `${local.slice(0, 1)}***@${domain}`;
}

const memberSnapshot = (m: StoreMember) => ({ userId: m.userId, groupId: m.groupId, status: m.status, suspendedByPlan: m.suspendedByPlan });

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(StoreGroup) private readonly groups: Repository<StoreGroup>,
    @InjectRepository(StoreMember) private readonly members: Repository<StoreMember>,
    @InjectRepository(Store) private readonly stores: Repository<Store>,
    private readonly activity: ActivityService,
    private readonly dataSource: DataSource,
  ) {}

  // ══════════════════════════ المجموعات (للمالك) ══════════════════════════

  async listGroups(storeId: string) {
    const rows = await this.groups.createQueryBuilder('g')
      .loadRelationCountAndMap('g.memberCount', 'g.members', 'm', (qb) => qb.where(`m.status IN ('accepted', 'pending')`))
      .where('g.storeId = :storeId', { storeId })
      .orderBy('g.createdAt', 'ASC')
      .getMany();
    return rows;
  }

  private async getGroup(storeId: string, groupId: string) {
    const g = await this.groups.findOne({ where: { id: groupId, storeId } });
    if (!g) throw err(NotFoundException, 'GROUP_NOT_FOUND', 'المجموعة غير موجودة في هذا المتجر');
    return g;
  }

  private async assertNameFree(storeId: string, name: string, exceptId?: string) {
    const [taken] = await this.dataSource.query(
      `SELECT 1 FROM store_groups WHERE "storeId" = $1 AND lower(name) = lower($2) AND ($3::uuid IS NULL OR id <> $3::uuid) LIMIT 1`,
      [storeId, name, exceptId ?? null],
    );
    if (taken) throw err(ConflictException, 'GROUP_NAME_TAKEN', 'يوجد مجموعة بهذا الاسم في هذا المتجر');
  }

  async createGroup(storeId: string, dto: CreateGroupDto, actorId: string) {
    await this.assertNameFree(storeId, dto.name);
    const g = await this.groups.save(this.groups.create({ storeId, name: dto.name, permissions: normalizePermissions(dto.permissions) }));
    await this.activity.logSafe({ storeId, userId: actorId, action: 'create', entity: 'group', entityId: g.id, entityName: g.name, after: { name: g.name, permissions: g.permissions, isActive: g.isActive } });
    return g;
  }

  async updateGroup(storeId: string, groupId: string, dto: UpdateGroupDto, actorId: string) {
    const g = await this.getGroup(storeId, groupId);
    const before = { name: g.name, permissions: g.permissions };
    if (dto.name !== undefined && dto.name !== g.name) { await this.assertNameFree(storeId, dto.name, g.id); g.name = dto.name; }
    if (dto.permissions) g.permissions = normalizePermissions(dto.permissions);
    const saved = await this.groups.save(g);
    const changes = this.activity.diff(before, { name: saved.name, permissions: saved.permissions });
    if (changes) await this.activity.logSafe({ storeId, userId: actorId, action: 'update', entity: 'group', entityId: g.id, entityName: g.name, ...changes });
    return saved;
  }

  async toggleGroup(storeId: string, groupId: string, actorId: string) {
    const g = await this.getGroup(storeId, groupId);
    g.isActive = !g.isActive;
    const saved = await this.groups.save(g);
    await this.activity.logSafe({ storeId, userId: actorId, action: 'update', entity: 'group', entityId: g.id, entityName: g.name, before: { isActive: !g.isActive }, after: { isActive: g.isActive } });
    return saved;
  }

  async deleteGroup(storeId: string, groupId: string, actorId: string) {
    const g = await this.getGroup(storeId, groupId);
    const count = await this.members.count({ where: { groupId: g.id, status: In(['accepted', 'pending']) } });
    if (count) throw err(ConflictException, 'GROUP_HAS_MEMBERS', 'لا يمكن حذف مجموعة فيها أعضاء — انقلهم لمجموعة أخرى أولاً');
    // الدعوات المرفوضة القديمة ليست أعضاء، لكنها تمنع الحذف (onDelete: RESTRICT)
    await this.members.delete({ groupId: g.id, status: 'rejected' });
    await this.groups.delete({ id: g.id });
    await this.activity.logSafe({ storeId, userId: actorId, action: 'delete', entity: 'group', entityId: g.id, entityName: g.name, before: { name: g.name, permissions: g.permissions, isActive: g.isActive } });
    return { success: true };
  }

  /** نسخ مجموعة من متجر آخر لنفس المالك (نسخة مستقلة)، مع دعوات جديدة لأعضائها اختيارياً */
  async importGroup(targetStoreId: string, ownerId: string, dto: ImportGroupDto, actorId: string) {
    // المصدر يجب أن يكون في متجر لنفس المالك
    const [owned] = await this.dataSource.query(
      `SELECT g.id FROM store_groups g JOIN stores s ON s.id = g."storeId" WHERE g.id = $1 AND s."userId" = $2`,
      [dto.sourceGroupId, ownerId],
    );
    const source = owned ? await this.groups.findOne({ where: { id: dto.sourceGroupId } }) : null;
    if (!source) throw err(NotFoundException, 'GROUP_NOT_FOUND', 'المجموعة غير موجودة في متاجرك');

    // اسم غير مكرر: «الاسم»، «الاسم 2»، «الاسم 3»…
    let name = source.name;
    for (let n = 2; ; n++) {
      const [taken] = await this.dataSource.query(`SELECT 1 FROM store_groups WHERE "storeId" = $1 AND lower(name) = lower($2)`, [targetStoreId, name]);
      if (!taken) break;
      name = `${source.name.slice(0, 74)} ${n}`;
    }
    const group = await this.groups.save(this.groups.create({ storeId: targetStoreId, name, permissions: normalizePermissions(source.permissions), isActive: source.isActive }));
    await this.activity.logSafe({ storeId: targetStoreId, userId: actorId, action: 'create', entity: 'group', entityId: group.id, entityName: group.name, after: { name, permissions: group.permissions, importedFrom: source.id } });

    const invited: string[] = [];
    const skipped: Array<{ userId: string; reason: 'SUSPENDED_BY_PLAN' | 'ALREADY_MEMBER' }> = [];
    if (dto.includeMembers) {
      const sourceMembers = await this.members.find({ where: { groupId: source.id, status: In(['accepted', 'pending']) } });
      for (const sm of sourceMembers) {
        if (sm.suspendedByPlan) { skipped.push({ userId: sm.userId, reason: 'SUSPENDED_BY_PLAN' }); continue; }
        const existing = await this.members.findOne({ where: { storeId: targetStoreId, userId: sm.userId } });
        if (existing && existing.status !== 'rejected') { skipped.push({ userId: sm.userId, reason: 'ALREADY_MEMBER' }); continue; }
        // نفس المالك ← المستخدم محسوب أصلاً في حده، فلا يتغير العدد
        const m = await this.upsertInvite(targetStoreId, sm.userId, group.id, actorId, existing);
        invited.push(sm.userId);
        await this.activity.logSafe({ storeId: targetStoreId, userId: actorId, action: 'create', entity: 'member', entityId: m.id, entityName: sm.userId, after: memberSnapshot(m) });
      }
    }
    return { group, invited, skipped };
  }

  // ══════════════════════════ الأعضاء (للمالك) ══════════════════════════

  async listMembers(storeId: string) {
    return this.dataSource.query(
      `SELECT m.id, m."userId", m."groupId", m.status, m."suspendedByPlan", m."joinedAt", m."createdAt",
              u.username AS name, u.image AS avatar, u.email,
              g.name AS "groupName", g."isActive" AS "groupActive", g.permissions
         FROM store_members m
         JOIN users u ON u.id = m."userId"
         LEFT JOIN store_groups g ON g.id = m."groupId"
        WHERE m."storeId" = $1 AND m.status IN ('accepted', 'pending')
        ORDER BY m."createdAt" ASC`,
      [storeId],
    ).then((rows: any[]) => rows.map(({ email, ...r }) => ({ ...r, maskedEmail: maskEmail(email) })));
  }

  /** عدّاد الخطة: المستخدمون المختلفون (مقبول/مدعو) عبر كل متاجر المالك مقابل الحد */
  async limits(ownerId: string) {
    const [max, all, active] = await Promise.all([
      ownerMemberLimit(this.dataSource, ownerId),
      distinctMemberIds(this.dataSource, ownerId),
      distinctMemberIds(this.dataSource, ownerId, true),
    ]);
    return { max: max ?? 0, used: all.length, active: active.length };
  }

  /** بحث دقيق فقط (بريد أو معرّف) — لا يكشف إلا اسماً وصورة وبريداً مقنّعاً */
  async userLookup(storeId: string, ownerId: string, q: string) {
    const query = q.trim();
    const [user] = UUID.test(query)
      ? await this.dataSource.query(`SELECT id, username, image, email FROM users WHERE id = $1`, [query])
      : await this.dataSource.query(`SELECT id, username, image, email FROM users WHERE lower(email) = lower($1)`, [query]);
    if (!user) throw err(NotFoundException, 'USER_NOT_FOUND', 'لا يوجد مستخدم مسجل بهذا البريد أو المعرّف');
    await this.assertInvitable(storeId, ownerId, user.id);
    return { id: user.id, name: user.username, avatar: user.image ?? null, maskedEmail: maskEmail(user.email) };
  }

  private async assertInvitable(storeId: string, ownerId: string, userId: string) {
    if (userId === ownerId) throw err(BadRequestException, 'SELF', 'لا يمكنك دعوة نفسك');
    const existing = await this.members.findOne({ where: { storeId, userId } });
    if (existing?.status === 'accepted') throw err(ConflictException, 'ALREADY_MEMBER', 'هذا المستخدم عضو في المتجر');
    if (existing?.status === 'pending') throw err(ConflictException, 'INVITE_PENDING', 'توجد دعوة معلّقة لهذا المستخدم');
    return existing;
  }

  /** حد الخطة: المستخدمون المختلفون (مقبول/مدعو) عبر كل متاجر المالك */
  private async assertMemberRoom(ownerId: string, newUserId: string) {
    const limit = await ownerMemberLimit(this.dataSource, ownerId);
    // رمز مختلف عن PLAN_EXPIRED (ذلك للعضو الذي فقد الوصول) حتى لا تعيد اللوحة المالك لقائمة المتاجر
    if (!limit) throw err(ForbiddenException, 'SHARING_NOT_ALLOWED', 'خطتك الحالية لا تتضمن أعضاء فريق — اختر خطة تسمح بمشاركة المتجر');
    const ids = await distinctMemberIds(this.dataSource, ownerId);
    if (ids.includes(newUserId)) return; // محسوب أصلاً (عضو في متجر آخر لنفس المالك)
    if (ids.length + 1 > limit) {
      throw err(ForbiddenException, 'MEMBER_LIMIT_REACHED', `وصلت لحد أعضاء خطتك (${limit}) — قم بترقية الخطة أو احذف عضواً`);
    }
  }

  // دعوة جديدة، أو إعادة استعمال صف مرفوض
  private async upsertInvite(storeId: string, userId: string, groupId: string | null, invitedBy: string, existing?: StoreMember | null) {
    if (existing) {
      Object.assign(existing, { groupId, status: 'pending', invitedBy, suspendedByPlan: false, joinedAt: null, createdAt: new Date() });
      return this.members.save(existing);
    }
    return this.members.save(this.members.create({ storeId, userId, groupId, invitedBy, status: 'pending' }));
  }

  async invite(storeId: string, ownerId: string, dto: InviteMemberDto, actorId: string) {
    const [user] = await this.dataSource.query(`SELECT id, username FROM users WHERE id = $1`, [dto.userId]);
    if (!user) throw err(NotFoundException, 'USER_NOT_FOUND', 'المستخدم غير موجود');
    const existing = await this.assertInvitable(storeId, ownerId, user.id);
    // المجموعة اختيارية عند الدعوة
    let groupId: string | null = null;
    if (dto.groupId) {
      const group = await this.getGroup(storeId, dto.groupId);
      if (!group.isActive) throw err(BadRequestException, AccessError.GROUP_DISABLED, 'المجموعة معطّلة');
      groupId = group.id;
    }
    await this.assertMemberRoom(ownerId, user.id);

    const m = await this.upsertInvite(storeId, user.id, groupId, actorId, existing);
    await this.activity.logSafe({ storeId, userId: actorId, action: 'create', entity: 'member', entityId: m.id, entityName: user.username, after: memberSnapshot(m) });
    return m;
  }

  private async getMember(storeId: string, memberId: string) {
    const m = await this.members.findOne({ where: { id: memberId, storeId } });
    if (!m) throw err(NotFoundException, 'MEMBER_NOT_FOUND', 'العضو غير موجود في هذا المتجر');
    return m;
  }

  /** إلغاء دعوة معلّقة أو إزالة عضو */
  async removeMember(storeId: string, memberId: string, actorId: string) {
    const m = await this.getMember(storeId, memberId);
    await this.members.delete({ id: m.id });
    await this.activity.logSafe({ storeId, userId: actorId, action: 'delete', entity: 'member', entityId: m.id, entityName: m.userId, before: memberSnapshot(m) });
    return { success: true };
  }

  async changeGroup(storeId: string, memberId: string, dto: ChangeMemberGroupDto, actorId: string) {
    const m = await this.getMember(storeId, memberId);
    let groupId: string | null = null;
    if (dto.groupId) {
      const group = await this.getGroup(storeId, dto.groupId);
      if (!group.isActive) throw err(BadRequestException, AccessError.GROUP_DISABLED, 'المجموعة معطّلة');
      groupId = group.id;
    }
    const before = memberSnapshot(m);
    m.groupId = groupId;
    const saved = await this.members.save(m);
    await this.activity.logSafe({ storeId, userId: actorId, action: 'update', entity: 'member', entityId: m.id, entityName: m.userId, before: { groupId: before.groupId }, after: { groupId } });
    return saved;
  }

  /**
   * تبديل يدوي ضمن حد الخطة: تعليق عضو لتفعيل آخر. يسري على كل عضويات هذا المستخدم عند نفس المالك
   * (لأن الحد يُحسب بالمستخدمين المختلفين).
   */
  async setSuspension(storeId: string, ownerId: string, memberId: string, suspended: boolean, actorId: string) {
    const m = await this.getMember(storeId, memberId);
    if (!suspended && m.suspendedByPlan) {
      const limit = (await ownerMemberLimit(this.dataSource, ownerId)) ?? 0;
      const active = (await distinctMemberIds(this.dataSource, ownerId, true)).filter((id) => id !== m.userId);
      if (active.length + 1 > limit) {
        throw err(ForbiddenException, 'MEMBER_LIMIT_REACHED', `حد خطتك ${limit} عضو — علّق عضواً آخر أولاً`);
      }
    }
    await setSuspended(this.dataSource, ownerId, [m.userId], suspended);
    await this.activity.logSafe({ storeId, userId: actorId, action: 'update', entity: 'member', entityId: m.id, entityName: m.userId, before: { suspendedByPlan: m.suspendedByPlan }, after: { suspendedByPlan: suspended } });
    return { success: true, suspended };
  }

  // ══════════════════════════ الدعوات (للمدعو) ══════════════════════════

  async myInvitations(userId: string) {
    return this.dataSource.query(
      `SELECT m.id, m."storeId", m."createdAt", s.name AS "storeName", s.subdomain,
              o.username AS "ownerName", g.name AS "groupName", g.permissions
         FROM store_members m
         JOIN stores s ON s.id = m."storeId"
         JOIN users o ON o.id = s."userId"
         LEFT JOIN store_groups g ON g.id = m."groupId"
        WHERE m."userId" = $1 AND m.status = 'pending'
        ORDER BY m."createdAt" DESC`,
      [userId],
    );
  }

  private async getInvitation(id: string, userId: string) {
    const m = await this.members.findOne({ where: { id, userId } });
    if (!m || m.status !== 'pending') throw err(NotFoundException, 'INVITATION_NOT_FOUND', 'الدعوة غير موجودة أو لم تعد معلّقة');
    return m;
  }

  async accept(id: string, userId: string) {
    const m = await this.getInvitation(id, userId);
    m.status = 'accepted';
    m.joinedAt = new Date();
    const saved = await this.members.save(m);
    await this.activity.logSafe({ storeId: m.storeId, userId, action: 'update', entity: 'member', entityId: m.id, entityName: userId, before: { status: 'pending' }, after: { status: 'accepted' } });
    return saved;
  }

  async reject(id: string, userId: string) {
    const m = await this.getInvitation(id, userId);
    m.status = 'rejected';
    const saved = await this.members.save(m);
    await this.activity.logSafe({ storeId: m.storeId, userId, action: 'update', entity: 'member', entityId: m.id, entityName: userId, before: { status: 'pending' }, after: { status: 'rejected' } });
    return saved;
  }

  async leave(storeId: string, userId: string) {
    const m = await this.members.findOne({ where: { storeId, userId } });
    if (!m || m.status === 'rejected') throw err(NotFoundException, 'NOT_A_MEMBER', 'لست عضواً في هذا المتجر');
    await this.members.delete({ id: m.id });
    await this.activity.logSafe({ storeId, userId, action: 'delete', entity: 'member', entityId: m.id, entityName: userId, before: memberSnapshot(m) });
    return { success: true };
  }

  // ══════════════════════════ قائمة المتاجر ══════════════════════════

  /** المتاجر التي المستخدم عضو مقبول فيها، مع صلاحياته وهل يمكن الدخول إليها الآن */
  async memberStores(userId: string) {
    const rows: Array<{ storeId: string; ownerId: string; ownerName: string; suspendedByPlan: boolean; groupId: string | null; groupActive: boolean; permissions: string[]; groupName: string }> =
      await this.dataSource.query(
        `SELECT m."storeId", s."userId" AS "ownerId", o.username AS "ownerName", m."suspendedByPlan", m."groupId", g."isActive" AS "groupActive", g.permissions, g.name AS "groupName"
           FROM store_members m
           JOIN stores s ON s.id = m."storeId"
           JOIN users o ON o.id = s."userId"
           LEFT JOIN store_groups g ON g.id = m."groupId"
          WHERE m."userId" = $1 AND m.status = 'accepted'`,
        [userId],
      );
    if (!rows.length) return [];
    const stores = await this.stores.createQueryBuilder('store')
      .leftJoinAndSelect('store.design', 'design')
      .leftJoinAndSelect('store.topBar', 'topBar')
      .leftJoinAndSelect('store.contact', 'contact')
      .leftJoinAndSelect('store.niche', 'niche')
      .loadRelationCountAndMap('store.ordersCount', 'store.orders')
      .loadRelationCountAndMap('store.productsCount', 'store.products')
      .where('store.id IN (:...ids)', { ids: rows.map((r) => r.storeId) })
      .getMany();
    const limits = new Map<string, number | null>();
    for (const ownerId of new Set(rows.map((r) => r.ownerId))) limits.set(ownerId, await ownerMemberLimit(this.dataSource, ownerId));

    return stores.map((store) => {
      const r = rows.find((x) => x.storeId === store.id)!;
      const reason = !limits.get(r.ownerId) ? AccessError.PLAN_EXPIRED
        : r.suspendedByPlan ? AccessError.MEMBER_SUSPENDED
          : !r.groupId ? AccessError.NO_GROUP
            : !r.groupActive ? AccessError.GROUP_DISABLED : null;
      return { ...store, role: 'member' as const, ownerId: r.ownerId, ownerName: r.ownerName, groupName: r.groupName, permissions: r.permissions ?? [], selectable: !reason, reason };
    });
  }

  ownerPermissions() {
    return ALL_PERMISSIONS;
  }
}
