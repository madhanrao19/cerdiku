import { Module } from '@nestjs/common';
import { BillingService } from './billing.service.js';
import { BillingController } from './billing.controller.js';

@Module({
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
