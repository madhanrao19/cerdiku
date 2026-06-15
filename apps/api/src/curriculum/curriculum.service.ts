import { Injectable } from '@nestjs/common';
import type { SubjectQuery } from '@kpm/types';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CurriculumService {
  constructor(private readonly prisma: PrismaService) {}

  listVersions() {
    return this.prisma.curriculumVersion.findMany({
      where: { status: { in: ['ACTIVE', 'UPCOMING'] } },
      orderBy: { effectiveFrom: 'asc' },
    });
  }

  listSchoolProfiles(filter: Partial<SubjectQuery>) {
    return this.prisma.schoolProfile.findMany({
      where: {
        level: filter.level,
        schoolType: filter.schoolType,
        medium: filter.language,
        dlpMode: filter.dlpMode,
      },
    });
  }

  // Lists subject *variants* (not bare subjects) because content is modeled per
  // school_type/language/DLP — the core KPM design decision.
  listSubjects(filter: SubjectQuery) {
    return this.prisma.subjectVariant.findMany({
      where: {
        level: filter.level,
        schoolType: filter.schoolType,
        language: filter.language,
        dlpMode: filter.dlpMode,
        curriculumVersion: filter.curriculumVersionCode
          ? { code: filter.curriculumVersionCode }
          : undefined,
      },
      include: {
        subject: true,
        curriculumVersion: { select: { code: true, label: true } },
      },
    });
  }

  getStandards(subjectVariantId: string) {
    return this.prisma.learningStandard.findMany({
      where: { subjectVariantId },
      orderBy: [{ strand: 'asc' }, { contentStandardCode: 'asc' }],
      include: {
        lessons: { select: { id: true, slug: true, title: true, status: true } },
      },
    });
  }
}
