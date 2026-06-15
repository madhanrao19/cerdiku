import { Module } from '@nestjs/common';
import { LearningService } from './learning.service.js';
import { LearningController } from './learning.controller.js';

@Module({
  controllers: [LearningController],
  providers: [LearningService],
  exports: [LearningService],
})
export class LearningModule {}
