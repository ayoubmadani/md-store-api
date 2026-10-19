import { Injectable, InternalServerErrorException, Logger, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { BuilderBlock, BLOCK_SYSTEM_PROMPT, languageNote } from './block-schema';
import { IMAGE_PAGE_SCHEMA } from '../builder-pages/image-page/image-page-prompt';

// Mirrors dashboard/src/pages/editor/blocks/componentsMap.js exactly — the
// generated tree is rendered by that same registry, so field names/types
// here and there must stay in sync. AI generation only ever produces these
// two blocks (see BLOCK_SYSTEM_PROMPT in block-schema.ts); everything else
// on a page is added manually in the editor.
const PAGE_TREE_SCHEMA = {
  type: 'object',
  properties: {
    blocks: {
      // Anthropic's structured-output schema support only allows minItems/
      // maxItems of 0 or 1 on arrays (an exact count like 2 is rejected at
      // request time) — the exact two-block, image-then-productForm shape
      // is enforced by the system prompt instead, plus orderBlocks() as a
      // deterministic guarantee on the ordering specifically.
      type: 'array',
      items: {
        anyOf: [
          {
            type: 'object',
            properties: {
              type: { const: 'image' },
              props: { type: 'object', properties: {}, additionalProperties: false },
            },
            required: ['type', 'props'],
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: {
              type: { const: 'productForm' },
              props: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  buttonText: { type: 'string' },
                  backgroundColor: { type: 'string', description: 'Hex color, e.g. #ffffff' },
                  textColor: { type: 'string', description: 'Hex color' },
                  buttonBackgroundColor: { type: 'string', description: 'Hex color' },
                  buttonTextColor: { type: 'string', description: 'Hex color' },
                  inputBackgroundColor: { type: 'string', description: 'Hex color' },
                  inputBorderColor: { type: 'string', description: 'Hex color' },
                  inputTextColor: { type: 'string', description: 'Hex color' },
                  containerBackgroundColor: { type: 'string', description: 'Hex color' },
                },
                required: [
                  'title',
                  'buttonText',
                  'backgroundColor',
                  'textColor',
                  'buttonBackgroundColor',
                  'buttonTextColor',
                  'inputBackgroundColor',
                  'inputBorderColor',
                  'inputTextColor',
                  'containerBackgroundColor',
                ],
                additionalProperties: false,
              },
            },
            required: ['type', 'props'],
            additionalProperties: false,
          },
        ],
      },
    },
  },
  required: ['blocks'],
  additionalProperties: false,
} as const;

@Injectable()
export class AnthropicService {
  private client: Anthropic | null = null;
  private readonly logger = new Logger('AnthropicService');
  private model: string;
  // صفحات الصور: نموذج أرخص منفصل (IMAGE_PAGE_MODEL) — باقي الإنشاء يبقى على ANTHROPIC_MODEL
  private imagePageModel: string;

  // Deliberately does NOT throw here if the key is missing — this service is
  // constructor-injected into BuilderPagesService, which NestJS instantiates
  // eagerly at app bootstrap regardless of which route is actually hit.
  // Throwing in the constructor previously crashed the *entire* API (every
  // route, not just AI generation) whenever ANTHROPIC_API_KEY wasn't set in
  // an environment — the missing key only matters once generatePageTree()
  // is actually called, so that's where it's now checked.
  constructor(private configService: ConfigService) {
    this.model = this.configService.get<string>('ANTHROPIC_MODEL') || 'claude-opus-4-8';
    this.imagePageModel = this.configService.get<string>('IMAGE_PAGE_MODEL') || 'claude-haiku-5-5';
  }

  private getClient(): Anthropic {
    if (this.client) return this.client;
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('ANTHROPIC_API_KEY is not configured. Please set it in .env file');
    }
    this.client = new Anthropic({ apiKey });
    return this.client;
  }

  // صفحة صور: HTML كامل + ألوان النموذج. البرومبت يُبنى في builder-pages/image-page.
  async generateImagePage(system: string, user: string): Promise<{ html: string; form: Record<string, string>; formAfter: number }> {
    const client = this.getClient();
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: this.imagePageModel,
        max_tokens: 16000,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        output_config: { format: { type: 'json_schema', schema: IMAGE_PAGE_SCHEMA as any } },
        messages: [{ role: 'user', content: user }],
      });
    } catch (error) {
      throw new InternalServerErrorException(`فشل تصميم الصفحة عبر الذكاء الاصطناعي: ${error.message}`);
    }
    // تكلفة كل صفحة في السجل: الخروج هو معظمها
    const u = response.usage;
    this.logger.log(`image-page ${this.imagePageModel} in=${u.input_tokens} cacheRead=${u.cache_read_input_tokens ?? 0} cacheWrite=${u.cache_creation_input_tokens ?? 0} out=${u.output_tokens}`);
    if (response.stop_reason === 'refusal') {
      throw new InternalServerErrorException('تعذر توليد المحتوى لهذا الوصف، حاول صياغة مختلفة.');
    }
    if (response.stop_reason === 'max_tokens') {
      throw new UnprocessableEntityException('الصفحة الناتجة طويلة جداً، حاول مرة أخرى.');
    }
    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new InternalServerErrorException('لم يتم إرجاع محتوى صالح من الذكاء الاصطناعي');
    }
    try {
      return JSON.parse(textBlock.text);
    } catch {
      throw new InternalServerErrorException('تعذر تحليل استجابة الذكاء الاصطناعي كـ JSON');
    }
  }

  async generatePageTree(productDescription: string, language: 'ar' | 'fr' | 'en' = 'ar'): Promise<BuilderBlock[]> {
    const client = this.getClient();
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: [
          {
            type: 'text',
            text: BLOCK_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        output_config: {
          format: { type: 'json_schema', schema: PAGE_TREE_SCHEMA },
        },
        messages: [
          {
            role: 'user',
            content: `${languageNote(language)}\n\nوصف المنتج:\n${productDescription}`,
          },
        ],
      });
    } catch (error) {
      throw new InternalServerErrorException(`فشل توليد الصفحة عبر الذكاء الاصطناعي: ${error.message}`);
    }

    if (response.stop_reason === 'refusal') {
      throw new InternalServerErrorException('تعذر توليد المحتوى لهذا الوصف، حاول صياغة مختلفة.');
    }

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new InternalServerErrorException('لم يتم إرجاع محتوى صالح من الذكاء الاصطناعي');
    }

    let parsed: { blocks: BuilderBlock[] };
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      throw new InternalServerErrorException('تعذر تحليل استجابة الذكاء الاصطناعي كـ JSON');
    }

    return parsed.blocks;
  }
}
