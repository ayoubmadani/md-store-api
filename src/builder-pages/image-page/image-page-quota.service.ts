import { Injectable } from '@nestjs/common';

export type ImagePageGenerationMeta = { storeId: string; builderPageId: string; language: string; style: string };

// مؤقت: بلا حدّ ولا احتساب — يُستبدل بالحد الشهري الحقيقي (image_page_generations) لاحقاً.
// العقد: consume ينفّذ run، ولا يحتسب شيئاً إن رمى run خطأ.
@Injectable()
export class ImagePageQuotaService {
  async consume<T>(_userId: string, _meta: ImagePageGenerationMeta, run: () => Promise<T>): Promise<T> {
    return run();
  }

  async usage(_userId: string): Promise<{ used: number; limit: number }> {
    return { used: 0, limit: 0 };
  }
}
