import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { BuilderBlock, BLOCK_SYSTEM_PROMPT, languageNote, pickBlockProps } from './block-schema';

// Uses the free-tier Gemini Developer API (aistudio.google.com API key) —
// NOT Vertex AI, which is billed GCP usage. This is the "free AI" path for
// the editor's demo/trial flow; real (paid) pages use AnthropicService.
//
// Gemini's responseSchema is a constrained subset of OpenAPI Schema with no
// anyOf/discriminated-union support, so unlike the Claude schema this one is
// flattened (one object with every possible field, all optional) and then
// reduced server-side via pickBlockProps() to just the fields that belong
// to each block's actual type. Same two-block vocabulary as Anthropic's
// schema (image, productForm) — see block-schema.ts.
const GEMINI_TREE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    blocks: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          type: { type: SchemaType.STRING, format: 'enum', enum: ['image', 'productForm'] },
          title: { type: SchemaType.STRING, nullable: true },
          buttonText: { type: SchemaType.STRING, nullable: true },
          backgroundColor: { type: SchemaType.STRING, description: 'Hex color', nullable: true },
          textColor: { type: SchemaType.STRING, description: 'Hex color', nullable: true },
          buttonBackgroundColor: { type: SchemaType.STRING, description: 'Hex color', nullable: true },
          buttonTextColor: { type: SchemaType.STRING, description: 'Hex color', nullable: true },
          inputBackgroundColor: { type: SchemaType.STRING, description: 'Hex color', nullable: true },
          inputBorderColor: { type: SchemaType.STRING, description: 'Hex color', nullable: true },
          inputTextColor: { type: SchemaType.STRING, description: 'Hex color', nullable: true },
          containerBackgroundColor: { type: SchemaType.STRING, description: 'Hex color', nullable: true },
        },
        required: ['type'],
      },
    },
  },
  required: ['blocks'],
} as const;

@Injectable()
export class GeminiService {
  private client: GoogleGenerativeAI | null = null;
  private model: string;

  // See AnthropicService for why this doesn't throw at construction time —
  // this service is eagerly instantiated at app bootstrap via DI, so a
  // missing key here previously crashed every route in the API, not just
  // the free-trial generation this actually powers.
  constructor(private configService: ConfigService) {
    this.model = this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
  }

  private getClient(): GoogleGenerativeAI {
    if (this.client) return this.client;
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('GEMINI_API_KEY is not configured. Get a free key at https://aistudio.google.com/apikey and set it in .env');
    }
    this.client = new GoogleGenerativeAI(apiKey);
    return this.client;
  }

  async generatePageTree(productDescription: string, language: 'ar' | 'fr' | 'en' = 'ar'): Promise<BuilderBlock[]> {
    const model = this.getClient().getGenerativeModel({
      model: this.model,
      systemInstruction: BLOCK_SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: GEMINI_TREE_SCHEMA as any,
      },
    });

    let text: string;
    try {
      const result = await model.generateContent(
        `${languageNote(language)}\n\nوصف المنتج:\n${productDescription}`
      );
      text = result.response.text();
    } catch (error) {
      throw new InternalServerErrorException(`فشل توليد الصفحة عبر الذكاء الاصطناعي: ${error.message}`);
    }

    let parsed: { blocks: Array<{ type: string } & Record<string, any>> };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new InternalServerErrorException('تعذر تحليل استجابة الذكاء الاصطناعي كـ JSON');
    }

    return (parsed.blocks || [])
      .filter((block) => ['image', 'productForm'].includes(block.type))
      .map((block) => pickBlockProps(block.type as any, block));
  }
}
