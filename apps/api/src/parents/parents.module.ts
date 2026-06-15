import { Module } from '@nestjs/common';
import { ParentsService } from './parents.service.js';
import { ParentsController } from './parents.controller.js';

@Module({
  controllers: [ParentsController],
  providers: [ParentsService],
})
export class ParentsModule {}
