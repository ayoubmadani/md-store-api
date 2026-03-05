import { Body, Controller, Param, Post } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
    constructor(private readonly aiService: AiService) { }

    @Post('generate-image')
    @Post('generate-product-image/:id')
    async generate(@Param('id') id: string) {
        //return this.aiService.generateProductImage(id,); // ✅ الصحيح
    }
}