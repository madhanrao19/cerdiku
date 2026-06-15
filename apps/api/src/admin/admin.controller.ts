import { Body, Controller, Get, Post, UsePipes } from '@nestjs/common';
import {
  createUserSchema,
  publishContentSchema,
  type CreateUserInput,
  type PublishContentInput,
} from '@kpm/types';
import { AdminService } from './admin.service.js';
import { CurrentUser, Roles, type AuthUser } from '../common/rbac.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Roles('ADMIN')
  @Get('users')
  listUsers() {
    return this.admin.listUsers();
  }

  @Roles('ADMIN')
  @Post('users')
  @UsePipes(new ZodValidationPipe(createUserSchema))
  createUser(@CurrentUser() actor: AuthUser, @Body() body: CreateUserInput) {
    return this.admin.createUser(actor.sub, body);
  }

  @Roles('ADMIN', 'CONTENT_ADMIN')
  @Get('content')
  listContent() {
    return this.admin.listContent();
  }

  @Roles('ADMIN', 'CONTENT_ADMIN')
  @Post('content/import')
  importContent(@CurrentUser() actor: AuthUser, @Body() body: unknown) {
    return this.admin.importContent(actor.sub, body);
  }

  @Roles('ADMIN', 'CONTENT_ADMIN')
  @Post('content/publish')
  @UsePipes(new ZodValidationPipe(publishContentSchema))
  publish(@CurrentUser() actor: AuthUser, @Body() body: PublishContentInput) {
    return this.admin.publish(actor.sub, body);
  }

  @Roles('ADMIN', 'SAFETY_REVIEWER')
  @Get('moderation/queue')
  moderationQueue() {
    return this.admin.moderationQueue();
  }

  @Roles('ADMIN')
  @Get('webhooks/log')
  webhookLog() {
    return this.admin.webhookLog();
  }
}
