# AI Image Landing Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From the page editor, a merchant turns 1–3 phone photos and product info into a landing page made of AI-designed section images, followed by a real order form styled to match.

**Architecture:**
- **Browser:** removes backgrounds and extracts a colour palette.
- **API:** asks Claude for one HTML document (sections + order-form colours), validates it, and counts usage against a monthly plan limit.
- **Browser again:** renders that HTML in a sandboxed iframe, captures each `<section class="s">` as a 1080px image, uploads the images, and replaces the page tree with image blocks plus the `productForm` block.

**Tech Stack:**
- **API:** NestJS + TypeORM + Postgres (`md-store-api`), `@anthropic-ai/sdk` (already used by `AnthropicService`), jest.
- **Dashboard:** React/Vite (`dashboard-order`), plus new packages `@imgly/background-removal`, `html-to-image` and `vitest`.
- **Admin:** React (`md-store-admin`). **MCP:** NestJS (`mcp-mdstore`).

**Spec:** `md-store-api/docs/superpowers/specs/2026-10-18-ai-image-landing-pages-design.md`

## Global Constraints

- Sections: `<section class="s">`, fixed width **720px**, height **600–1100px**, side padding ≥ **32px**, min font **26px**, headings ≥ **48px**.
- Captured images: **1080px** wide (`pixelRatio: 1.5`), **WebP**, falling back to **JPEG 0.9**.
- Fonts: **Lalezar** (headings) and **Tajawal** 500/800 (text); every number goes in `<span class="num">`.
- Languages `ar` (rtl), `fr` and `en` (ltr), chosen by the merchant (default: store language).
- Styles: `مرح، فاخر، رياضي، طبي، أطفال، تقليدي، عصري بسيط`, plus `auto`.
- Never generated: testimonials, before/after, invented facts, medical promises.
- Section count **3–6**. No `<script>`, no `on*=`, no external URLs except placeholders, no `position: fixed`.
- Image placeholders: `{{IMG_1..3}}` (cutouts) and `{{DETAIL_1..3}}` (original photos).
- Plan feature `imagePagesPerMonth` (int, default **0**). The month resets on the 1st, `Africa/Algiers`.
- Usage is counted **only** after Claude's HTML passes validation.
- Order-form keys returned by Claude: exactly `BLOCK_FIELD_KEYS.productForm` from `src/ai/block-schema.ts`.
- **Never push or run migrations without the owner's explicit "ارفع" / "شغّل"** (shared production DB).

## Review Focus

1. **Huge or HEIC phone photos (8–12 MP):** must be downscaled to ≤ 1600px longest side before background removal, or the tab freezes. → Task 5 test `downscale.test`.
2. **Claude returns a section taller than 1100px, or one with text overflowing:** the capture crops to 1100px, and nothing fails. → Task 6 test `capture crops tall sections`.
3. **Fonts not loaded at capture time:** the images come out in a fallback font. Capture must await `document.fonts.ready` and both font faces. → Task 6 test `waits for fonts`.
4. **Two generations started at once at limit−1:** only one may succeed. The limit check and the usage insert run in one transaction with a row lock. → Task 1 test `concurrent at limit`.
5. **Claude HTML with `<img src="https://…">` or `<script>`:** rejected, with one retry, and never rendered. → Task 2 tests `rejects external url`, `rejects script`.

---

### Task 1: Plan feature, usage table, quota service (API)

**Files:**
- Modify: `src/subscription/entities/features.entity.ts`
- Modify: `src/subscription/dto/create-plan.dto.ts`
- Create: `src/migrations/1794900000000-ImagePages.ts`
- Create: `src/builder-pages/image-page/image-page-generation.entity.ts`
- Create: `src/builder-pages/image-page/image-page-quota.service.ts`
- Test: `src/builder-pages/image-page/image-page-quota.service.spec.ts`

**Interfaces:**
- Produces:
  - `ImagePageQuotaService.usage(userId: string): Promise<{ used: number; limit: number }>`
  - `ImagePageQuotaService.consume(userId: string, meta: { storeId: string; builderPageId: string; language: 'ar'|'fr'|'en'; style: string }, run: () => Promise<T>): Promise<T>`. It runs `run()`; on success it inserts the usage row, then returns the result. If the limit is reached it throws `BadRequestException` **before** `run()`. The check and the insert are serialised per user with `pg_advisory_xact_lock(hashtext(userId))`.
- Entity `image_page_generations`: `id uuid`, `userId uuid`, `storeId uuid`, `builderPageId uuid`, `language varchar(2)`, `style varchar(20)`, `createdAt timestamptz default now()`, index `(userId, createdAt)`.
- The limit query copies `ShippingService.profileLimit` (active subscription → `plan_features."imagePagesPerMonth"`, 0 when there is no subscription). The month window is `date_trunc('month', now() AT TIME ZONE 'Africa/Algiers')`.

- [ ] **Step 1: Failing tests** (jest, with a mocked `DataSource`/manager):
  - `usage returns 0/limit for a new user`
  - `consume throws at limit and does not call run`
  - `consume does not insert when run throws`
  - `consume inserts one row on success`
  - `concurrent at limit`: two `consume` calls at limit−1 → exactly one resolves.
- [ ] **Step 2:** `pnpm jest image-page-quota` → FAIL.
- [ ] **Step 3: Implement**
  - The entity, the feature column `imagePagesPerMonth` (`@Column({ type: 'int', default: 0 })`), and the DTO field (`@IsInt() @Min(0) @IsOptional()`).
  - The migration (ADD COLUMN on `plan_features`, CREATE TABLE plus index, DOWN reverses both). Register the entity in `BuilderPagesModule`.
- [ ] **Step 4:** `pnpm jest image-page-quota` → PASS, then `npx tsc --noEmit -p tsconfig.json` → no output.
- [ ] **Step 5: Commit**
  ```bash
  git commit -m "feat(image-pages): plan limit and usage tracking"
  ```

### Task 2: Prompt builder and HTML validator (API, pure)

**Files:**
- Create: `src/builder-pages/image-page/image-page-prompt.ts`
- Test: `src/builder-pages/image-page/image-page-prompt.spec.ts`

**Interfaces:**
- Produces:
  - `export type ImagePageInput = { productName: string; description: string; price: number; oldPrice?: number|null; variants?: string; category?: string; language: 'ar'|'fr'|'en'; style: string; palette: string[]; cutouts: number; details: number; shipsAllWilayas: boolean }`
  - `buildImagePageSystemPrompt(language): string`: the owner's prompt (spec appendix / chat), with `{{…}}` product slots left as instructions, the direction (`rtl`/`ltr`) and the language name substituted, and testimonials/before-after removed.
  - `buildImagePageUserMessage(input: ImagePageInput, variation: { heroLayout: string; decor: string }): string`
  - `pickVariation(rand = Math.random): { heroLayout: string; decor: string }`: chosen from two fixed lists of ≥ 5 entries each, written in the file.
  - `IMAGE_PAGE_SCHEMA`: a JSON schema `{ html: string, form: { …BLOCK_FIELD_KEYS.productForm }, formAfter: integer }`.
  - `validateImagePageHtml(html: string, cutouts: number, details: number): { ok: true } | { ok: false; reason: string }`

- [ ] **Step 1: Failing tests:**
  - `accepts 3..6 sections`
  - `rejects 2 sections`, `rejects 7 sections`
  - `rejects script`, `rejects onclick=`, `rejects external url` (`src="https://x"`, `url(http…)`)
  - `rejects position:fixed`
  - `rejects unknown placeholder {{IMG_4}} when cutouts=3`
  - `system prompt contains dir="rtl" for ar and dir="ltr" for fr`
  - `system prompt never mentions آراء الزبائن`
  - `pickVariation is deterministic with a stubbed rand`
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** The validator uses regexes on the raw string, and counts sections with `/<section\b[^>]*class="[^"]*\bs\b/g`.
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5: Commit**
  ```bash
  git commit -m "feat(image-pages): prompt and validation"
  ```

### Task 3: Generation and section-upload endpoints (API)

**Files:**
- Modify: `src/ai/anthropic.service.ts`. Add `generateImagePage(system: string, user: string): Promise<{ html: string; form: Record<string,string>; formAfter: number }>`, with `max_tokens: 16000`, `output_config` JSON schema `IMAGE_PAGE_SCHEMA`, and the same refusal and parse handling as `generatePageTree`.
- Create: `src/builder-pages/image-page/image-page.service.ts`
- Create: `src/builder-pages/dto/generate-image-page.dto.ts`
- Modify: `src/builder-pages/builder-pages.controller.ts`, `src/builder-pages/builder-pages.module.ts`
- Test: `src/builder-pages/image-page/image-page.service.spec.ts`

**Interfaces:**
- Consumes:
  - Task 1: `ImagePageQuotaService.consume/usage`.
  - Task 2: all exports.
  - `BuilderPagesService.findOne(id, userId)` and `resolveDescription(dto)` (existing).
- Produces the HTTP API (all `AuthGuard`):
  - `GET /builder-pages/image-pages/usage` → `{ used, limit }`
  - `POST /builder-pages/:id/generate-image-page`
    - **Body:** `GenerateImagePageDto { productId?: uuid; description?: string; language: 'ar'|'fr'|'en'; style: string; palette: string[] (1..6, /^#[0-9a-f]{6}$/i); cutouts: 1..3; details: 0..3 }`
    - **Returns:** `{ generationId: uuid; html: string; form: Record<string,string>; formAfter: number }`
    - Validates; on failure retries **once**, with the reason appended to the user message; on a second failure → `UnprocessableEntityException`, and nothing is counted.
  - `POST /builder-pages/:id/image-page-sections`
    - **Request:** multipart `files[]` (1..6, image/webp|jpeg, ≤ 2 MB each) + `generationId`.
    - **Storage:** uploads to R2 under `image-pages/<storeId>/<generationId>/<n>.<ext>` via `S3Service.uploadBuffer`. It is **not** stored in the `images` library, so it does **not** count against `totalImagesNumber`.
    - **Returns:** `{ urls: string[] }`
    - **403** if `generationId` does not belong to the user.

- [ ] **Step 1: Failing tests** (mock Anthropic + quota):
  - `retries once then succeeds`
  - `second invalid → 422 and consume not committed`
  - `style auto maps from category` (`sport → رياضي`; `kids → أطفال`; default → `عصري بسيط`)
  - `price/variants come from product when productId given`
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement the service, DTO and routes. Declare `image-pages/usage` **before** the `:id` routes.
- [ ] **Step 4:** run → PASS, then `npx tsc --noEmit` → no output.
- [ ] **Step 5: Commit**
  ```bash
  git commit -m "feat(image-pages): generate and upload endpoints"
  ```

### Task 4: Admin plan field and MCP (md-store-admin, mcp-mdstore)

**Files:**
- Modify: `md-store-admin/src/page/plan/plan.jsx`. Add the `imagePagesPerMonth` default `0`, the form field «Image pages / month (0 = off)», and a pill with an `Images` icon.
- Modify: `mcp-mdstore/src/tools/admin-themes.tool.ts`. Add `imagePagesPerMonth` to the `admin_update_plan` description list and to the `features` zod object (`z.number().int().min(0).optional()`).

- [ ] **Step 1:** Edit both files.
- [ ] **Step 2:**
  - `cd md-store-admin && npx vite build --logLevel error` → exit 0.
  - `cd mcp-mdstore && npx tsc --noEmit` → no output.
- [ ] **Step 3: Commit** in each repo:
  ```bash
  git commit -m "feat: imagePagesPerMonth plan limit"
  ```

### Task 5: Browser image prep (dashboard-order)

**Files:**
- Create: `src/pages/editor/imagePage/prep.js`
- Test: `src/pages/editor/imagePage/prep.test.js`
- Modify: `package.json`. Add `@imgly/background-removal`, `html-to-image`, `vitest`, and the script `"test": "vitest run"`.

**Interfaces:**
- Produces:
  - `downscale(file: File|Blob, maxSide = 1600): Promise<Blob>`: JPEG; decodes HEIC via `createImageBitmap` when supported, and otherwise throws `Error('unsupported_image')`.
  - `removeBackgroundCached(blob: Blob): Promise<Blob>`: PNG. The cache is IndexedDB `mdstore-cutouts`, keyed by the SHA-256 of the input bytes.
  - `extractPalette(blob: Blob, count = 5): Promise<string[]>`: `#rrggbb`, ignoring transparent and near-white/near-black pixels (median cut or k-means on a 64×64 sample).
  - `blobToDataUrl(blob: Blob): Promise<string>`

- [ ] **Step 1: Failing vitest tests** (jsdom + canvas mock):
  - `downscale.test`: a 4000×3000 input → longest side 1600.
  - `extractPalette returns hex colors, excludes transparent`
  - `cache hit returns stored blob without calling remover` (mock the module).
- [ ] **Step 2:** `npx vitest run src/pages/editor/imagePage` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5: Commit**
  ```bash
  git commit -m "feat(image-pages): browser image prep"
  ```

### Task 6: Render and capture sections (dashboard-order)

**Files:**
- Create: `src/pages/editor/imagePage/capture.js`
- Create: `src/pages/editor/imagePage/fonts.js`
- Test: `src/pages/editor/imagePage/capture.test.js`

**Interfaces:**
- Consumes: `blobToDataUrl` (Task 5).
- Produces:
  - `fillPlaceholders(html: string, images: { IMG: string[]; DETAIL: string[] }): string`: data URLs. An unknown placeholder becomes a 1×1 transparent PNG.
  - `captureSections(html: string, { pixelRatio = 1.5, maxHeight = 1100 } = {}): Promise<Blob[]>`
    - Creates a hidden 720px-wide `<iframe sandbox="allow-same-origin">` (no `allow-scripts`) with `srcdoc`.
    - Injects `@font-face` for Lalezar and Tajawal 500/800 from `fonts.js` data URLs.
    - Awaits `doc.fonts.ready` and `doc.fonts.load('48px Lalezar')`, `('26px Tajawal')`.
    - Captures each `section.s` with `html-to-image` `toBlob` (type `image/webp`, quality 0.92), cropping the height to `maxHeight`.
    - Falls back to `image/jpeg` 0.9 when the WebP blob type is wrong.
    - Removes the iframe in `finally`.
- **Font files:** `fonts.js` fetches `/fonts/Lalezar-Regular.woff2`, `/fonts/Tajawal-Medium.woff2` and `/fonts/Tajawal-ExtraBold.woff2` (added to `public/fonts/`, from Google Fonts, OFL) and caches the data URLs.

- [ ] **Step 1: Failing tests** (mock `html-to-image`):
  - `fillPlaceholders replaces IMG and DETAIL`
  - `unknown placeholder → transparent`
  - `capture crops tall sections` (a section of height 1500 → captured height ≤ 1100×1.5)
  - `waits for fonts` (`fonts.load` called before `toBlob`)
  - `iframe has no allow-scripts`
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement, and add the three woff2 files.
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5: Commit**
  ```bash
  git commit -m "feat(image-pages): section capture"
  ```

### Task 7: Editor flow (dashboard-order)

**Files:**
- Modify: `src/pages/editor/components/GenerateModal.jsx`. Add a top-level kind switch **«بلوكات» / «صفحة صور احترافية»** (`kind: 'blocks'|'images'`). For `images` show:
  - the product picker or manual description (existing);
  - a 1–3 photo picker (product photos preselected);
  - language (default store language);
  - style (`auto` + 7);
  - the usage line `t('editor.imagePage.usage', { used, limit })`;
  - the submit button, disabled when `used >= limit` (showing `editor.imagePage.upgrade`).
- Create: `src/pages/editor/imagePage/useImagePageGenerator.js`
- Modify: `src/pages/editor/PageEditor.jsx`. Route `kind === 'images'` to the new hook and show progress steps.
- Modify: `src/locales/{ar,fr,en}/editor.json`. Add keys under `editor.imagePage.*`: `kind`, `photos`, `style`, `styles.*`, `usage`, `upgrade`, and `steps.{cutout,palette,design,capture,upload}`, plus `error`, `retryCapture`.

**Interfaces:**
- Consumes: Tasks 3, 5 and 6, plus the existing `usePageBuilder().setBlocks`.
- Produces: `useImagePageGenerator(pageId)` → `{ run(input): Promise<boolean>, step: 'cutout'|'palette'|'design'|'capture'|'upload'|null, usage: {used, limit}, retryCapture(): Promise<boolean> }`.
  - `run` downscales, removes the background, and extracts the palette. It then calls `POST generate-image-page`, captures the sections, uploads them via `POST image-page-sections`, and builds the tree:
    - each section URL → `{ id: uuid, type: 'image', props: { ...imageDefaults, src: url, width: 100 } }`;
    - `productForm` inserted after index `formAfter` with `{ ...productFormDefaults, ...form, productId }`.
  - `retryCapture` reuses the last `html`/`generationId` (no new Claude call, no new count).

- [ ] **Step 1:** `npx vite build --logLevel error` before the change → exit 0 (baseline).
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** `npx vite build --logLevel error` → exit 0, and `npx vitest run` → all PASS.
- [ ] **Step 4: Manual check** against the local API with `imagePagesPerMonth` set to 2 on a test plan:
  1. Generate a page with 2 photos in `ar` → 5 images + form, usage 1/2.
  2. Regenerate in `fr` → usage 2/2, the button is then disabled.
  3. Kill the network during upload → the error shows «إعادة المحاولة», which succeeds without changing usage.
- [ ] **Step 5: Commit**
  ```bash
  git commit -m "feat(image-pages): editor flow"
  ```

### Task 8: Release (owner-gated)

- [ ] **Step 1:** Ask the owner for «شغّل», then run the migration: `npx typeorm-ts-node-commonjs migration:run -d src/data-source.ts` (expect only `ImagePages1794900000000` pending).
- [ ] **Step 2:** Ask the owner for «ارفع», then push md-store-api, dashboard-order, md-store-admin and mcp-mdstore.
- [ ] **Step 3:** Set `imagePagesPerMonth` per plan from the admin panel (the owner decides the values).
