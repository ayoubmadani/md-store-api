import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NtfyService } from './ntfy.service';

@Module({
  imports: [HttpModule],
  providers: [NtfyService],
  exports: [NtfyService], // لتتمكن من استخدامه في موديلات أخرى
})
export class NtfyModule {}