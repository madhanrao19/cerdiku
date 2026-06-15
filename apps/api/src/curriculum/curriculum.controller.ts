import { Controller, Get, Param, Query, UsePipes } from '@nestjs/common';
import { subjectQuerySchema, type SubjectQuery } from '@kpm/types';
import { CurriculumService } from './curriculum.service.js';
import { Public } from '../common/rbac.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller()
export class CurriculumController {
  constructor(private readonly curriculum: CurriculumService) {}

  @Public()
  @Get('curriculum/versions')
  versions() {
    return this.curriculum.listVersions();
  }

  @Public()
  @Get('school-profiles')
  @UsePipes(new ZodValidationPipe(subjectQuerySchema.partial()))
  schoolProfiles(@Query() query: Partial<SubjectQuery>) {
    return this.curriculum.listSchoolProfiles(query);
  }

  @Public()
  @Get('subjects')
  @UsePipes(new ZodValidationPipe(subjectQuerySchema))
  subjects(@Query() query: SubjectQuery) {
    return this.curriculum.listSubjects(query);
  }

  @Public()
  @Get('subjects/:id/standards')
  standards(@Param('id') id: string) {
    return this.curriculum.getStandards(id);
  }
}
