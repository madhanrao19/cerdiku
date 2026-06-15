import { Body, Controller, Get, Param, Post, UsePipes } from '@nestjs/common';
import { studyPlanSchema, type StudyPlanInput } from '@kpm/types';
import { ParentsService } from './parents.service.js';
import { CurrentUser, Roles, type AuthUser } from '../common/rbac.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller()
export class ParentsController {
  constructor(private readonly parents: ParentsService) {}

  @Roles('PARENT', 'ADMIN')
  @Get('parents/dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.parents.dashboard(user.householdId ?? null);
  }

  @Roles('PARENT', 'ADMIN')
  @Post('parents/study-plans')
  @UsePipes(new ZodValidationPipe(studyPlanSchema))
  setStudyPlan(@CurrentUser() user: AuthUser, @Body() body: StudyPlanInput) {
    return this.parents.setStudyPlan(user.householdId ?? null, body);
  }

  @Roles('PARENT', 'ADMIN', 'STUDENT')
  @Get('students/:id/progress')
  progress(@Param('id') id: string) {
    return this.parents.studentProgress(id);
  }

  @Roles('PARENT', 'ADMIN')
  @Get('reports/pbd/:studentId')
  pbd(@Param('studentId') studentId: string) {
    return this.parents.pbdReport(studentId);
  }
}
