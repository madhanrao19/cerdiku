import { Module } from '@nestjs/common';
import { TutorService } from './tutor.service.js';
import { TutorController } from './tutor.controller.js';
import { RagService } from './rag.service.js';

@Module({
  controllers: [TutorController],
  providers: [TutorService, RagService],
  exports: [TutorService, RagService],
})
export class TutorModule {}
