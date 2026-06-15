import { Body, Controller, Get, Param, Post, UsePipes } from '@nestjs/common';
import { submitAttemptSchema, type SubmitAttemptInput } from '@kpm/types';
import { LearningService } from './learning.service.js';
import { CurrentUser, Public, Roles, type AuthUser } from '../common/rbac.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ForbiddenException } from '@nestjs/common';

@Controller()
export class LearningController {
  constructor(
    private readonly learning: LearningService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('lessons/:id')
  getLesson(@Param('id') id: string) {
    return this.learning.getLesson(id);
  }

  @Roles('STUDENT')
  @Post('activities/:id/start')
  async startActivity(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const studentId = await this.resolveStudentId(user);
    return this.learning.startActivity(id, studentId);
  }

  @Roles('STUDENT')
  @Post('attempts/:id/submit')
  @UsePipes(new ZodValidationPipe(submitAttemptSchema))
  async submit(
    @Param('id') id: string,
    @Body() body: SubmitAttemptInput,
    @CurrentUser() user: AuthUser,
  ) {
    const studentId = await this.resolveStudentId(user);
    return this.learning.submitAttempt(id, studentId, body);
  }

  // A STUDENT-role user maps to exactly one Student profile.
  private async resolveStudentId(user: AuthUser): Promise<string> {
    const student = await this.prisma.student.findUnique({
      where: { userId: user.sub },
      select: { id: true },
    });
    if (!student) throw new ForbiddenException('No student profile for this account');
    return student.id;
  }
}
