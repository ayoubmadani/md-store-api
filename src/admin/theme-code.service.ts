import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { build, type Plugin } from 'esbuild';
import { Repository } from 'typeorm';
import { S3Service } from '../image/s3.service';
import { Theme } from '../theme/entities/theme.entity';

// ما يوفّره المتجر وقت التشغيل — أي استيراد آخر يُرفض (الثيم ملف واحد مستقل)
const ALLOWED_IMPORTS = [
  'react', 'react-dom', 'react/jsx-runtime',
  'next/link', 'next/image', 'next/navigation',
  'axios', 'zustand', 'zustand/middleware',
  'lucide-react', 'framer-motion', 'isomorphic-dompurify', 'uuid',
  '@mdstore/theme-kit',
];
// ما يطلبه المتجر من كل ثيم (Success اختياري)
const REQUIRED_EXPORTS = ['default', 'Home', 'Details', 'Cart', 'StaticPage'];
const MAX_SOURCE_BYTES = 600 * 1024;

const onlyAllowedImports: Plugin = {
  name: 'only-allowed-imports',
  setup(b) {
    b.onResolve({ filter: /.*/ }, (args) => {
      if (args.kind === 'entry-point') return undefined;
      if (ALLOWED_IMPORTS.includes(args.path)) return { path: args.path, external: true };
      return { errors: [{ text: `استيراد غير مسموح: "${args.path}" — المسموح: ${ALLOWED_IMPORTS.join(', ')}` }] };
    });
  },
};

/**
 * كود ثيم (TSX ملف واحد) ← فحص + بناء (نفس صيغة scripts/bundle-themes.mjs في mdstore-store) ← رفع إلى
 * themes/<slug>.js في نفس الـ bucket الذي يقرأ منه المتجر. المصدر يُحفظ أيضاً في theme-src/<slug>.tsx.
 */
@Injectable()
export class ThemeCodeService {
  constructor(
    @InjectRepository(Theme) private readonly themes: Repository<Theme>,
    private readonly s3: S3Service,
  ) { }

  async publish(slug: string, code: string) {
    const theme = await this.themes.findOne({ where: { slug } });
    if (!theme) throw new NotFoundException(`لا يوجد ثيم بالـ slug «${slug}» — أنشئه أولاً`);
    if (!code?.trim()) throw new BadRequestException('الكود فارغ');
    if (Buffer.byteLength(code) > MAX_SOURCE_BYTES) throw new BadRequestException('الكود أكبر من 600KB');

    const common = {
      stdin: { contents: code, loader: 'tsx' as const, sourcefile: `${slug}.tsx`, resolveDir: '/' },
      bundle: true,
      write: false,
      jsx: 'automatic' as const,
      target: 'es2020',
      logLevel: 'silent' as const,
      plugins: [onlyAllowedImports],
    };

    // 1) فحص الـ exports (صيغة esm تعطي قائمتها في الـ metafile)
    let exportsFound: string[];
    try {
      const esm = await build({ ...common, format: 'esm', platform: 'browser', metafile: true, outfile: 'check.js' });
      exportsFound = Object.values(esm.metafile.outputs)[0]?.exports ?? [];
    } catch (err: any) {
      throw new BadRequestException(formatBuildError(err));
    }
    const missing = REQUIRED_EXPORTS.filter((e) => !exportsFound.includes(e));
    if (missing.length) throw new BadRequestException(`exports ناقصة: ${missing.join(', ')}`);

    // 2) البناء الفعلي — cjs كما يقرؤه ThemeRunner و theme-loader
    let bundle: string;
    try {
      const out = await build({ ...common, format: 'cjs', platform: 'node', outfile: `${slug}.js` });
      bundle = out.outputFiles?.[0]?.text ?? '';
      if (!bundle) throw new Error('empty bundle');
    } catch (err: any) {
      throw new BadRequestException(formatBuildError(err));
    }

    await this.s3.uploadBuffer(Buffer.from(code), `theme-src/${slug}.tsx`, 'text/plain; charset=utf-8');
    const uploaded = await this.s3.uploadBuffer(Buffer.from(bundle), `themes/${slug}.js`, 'application/javascript');

    return {
      slug,
      themeId: theme.id,
      isActive: theme.isActive,
      bundleBytes: Buffer.byteLength(bundle),
      exports: exportsFound,
      key: uploaded.key,
    };
  }
}

function formatBuildError(err: any): string {
  const errors: any[] = err?.errors ?? [];
  if (!errors.length) return `فشل بناء الثيم: ${err?.message ?? err}`;
  return 'فشل بناء الثيم:\n' + errors.slice(0, 8).map((e) =>
    `- ${e.text}${e.location ? ` (سطر ${e.location.line}:${e.location.column}: ${e.location.lineText?.trim().slice(0, 120)})` : ''}`,
  ).join('\n');
}
