import { Module } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { AdminController } from './admin.controller.js';
import { AnalyticsController } from '../analytics/analytics.controller.js';

@Module({
  controllers: [AdminController, AnalyticsController],
  providers: [AdminService],
})
export class AdminModule {}
