/**
 * Demo seed. All content is ORIGINAL placeholder material mapped to curriculum
 * metadata — it contains no copyrighted KPM textbook text.
 *
 * Run: pnpm --filter @kpm/api db:seed
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { MockProvider } from '@kpm/ai';

const prisma = new PrismaClient();
const embedder = new MockProvider();

async function main() {
  console.log('Seeding demo data…');

  // --- Organization + household + users ------------------------------------
  const org = await prisma.organization.create({
    data: { name: 'Demo Learning Co', tenantType: 'INSTITUTION' },
  });

  const household = await prisma.household.create({
    data: { displayName: 'Tan Family', organizationId: org.id, locale: 'en-MY' },
  });

  const parentPw = await argon2.hash('parent1234');
  const adminPw = await argon2.hash('admin1234');
  const studentPw = await argon2.hash('student1234');

  const parent = await prisma.user.create({
    data: { email: 'parent@demo.my', passwordHash: parentPw, role: 'PARENT', householdId: household.id },
  });
  await prisma.user.create({
    data: { email: 'admin@demo.my', passwordHash: adminPw, role: 'ADMIN', organizationId: org.id },
  });
  await prisma.consent.create({
    data: { userId: parent.id, consentType: 'PRIVACY_NOTICE', version: '1.0' },
  });

  const studentUser = await prisma.user.create({
    data: { passwordHash: studentPw, role: 'STUDENT', householdId: household.id },
  });
  const student = await prisma.student.create({
    data: {
      householdId: household.id,
      userId: studentUser.id,
      fullName: 'Aiman Tan',
      dob: new Date('2017-04-01'),
      level: 'PRIMARY',
      languagePref: 'BM',
      dlpMode: 'NONE',
      schoolType: 'SK',
      guardians: { create: { userId: parent.id, relationship: 'parent', isPrimary: true } },
    },
  });

  // --- Curriculum versions -------------------------------------------------
  const kssr = await prisma.curriculumVersion.create({
    data: { code: 'KSSR-2017', label: 'KSSR (Semakan 2017)', status: 'ACTIVE', effectiveFrom: new Date('2017-01-01') },
  });
  const kssm = await prisma.curriculumVersion.create({
    data: { code: 'KSSM-2017', label: 'KSSM (Semakan 2017)', status: 'ACTIVE', effectiveFrom: new Date('2017-01-01') },
  });
  const preschool = await prisma.curriculumVersion.create({
    data: { code: 'PRASEKOLAH-2026', label: 'Kurikulum Prasekolah 2026', status: 'ACTIVE', effectiveFrom: new Date('2026-01-01') },
  });
  await prisma.curriculumVersion.create({
    data: { code: 'KP-2027', label: 'Kurikulum Persekolahan 2027', status: 'UPCOMING', effectiveFrom: new Date('2027-01-01') },
  });

  // --- School profiles -----------------------------------------------------
  const profiles = [
    { level: 'PRESCHOOL', schoolType: 'PRIVATE', medium: 'BM', dlpMode: 'NONE' },
    { level: 'PRIMARY', schoolType: 'SK', medium: 'BM', dlpMode: 'NONE' },
    { level: 'PRIMARY', schoolType: 'SJKC', medium: 'ZH', dlpMode: 'NONE' },
    { level: 'PRIMARY', schoolType: 'SJKT', medium: 'TA', dlpMode: 'NONE' },
    { level: 'PRIMARY', schoolType: 'SK', medium: 'EN', dlpMode: 'DLP_SUBJECT_VARIANT' },
    { level: 'LOWER_SECONDARY', schoolType: 'SMK', medium: 'BM', dlpMode: 'NONE' },
    { level: 'UPPER_SECONDARY', schoolType: 'SMK', medium: 'BM', dlpMode: 'NONE' },
    { level: 'UPPER_SECONDARY', schoolType: 'SMK', medium: 'EN', dlpMode: 'DLP_SUBJECT_VARIANT' },
  ] as const;
  for (const p of profiles) {
    await prisma.schoolProfile.create({ data: p as never });
  }
  const skPrimaryProfile = await prisma.schoolProfile.findFirst({
    where: { level: 'PRIMARY', schoolType: 'SK', medium: 'BM', dlpMode: 'NONE' },
  });

  // --- Subjects ------------------------------------------------------------
  const math = await prisma.subject.create({ data: { code: 'MATH', name: 'Mathematics', domain: 'STEM' } });
  const english = await prisma.subject.create({ data: { code: 'ENG', name: 'English', domain: 'Language' } });
  const science = await prisma.subject.create({ data: { code: 'SCI', name: 'Science', domain: 'STEM' } });
  const preMath = await prisma.subject.create({ data: { code: 'PRE-NUM', name: 'Early Numeracy', domain: 'Preschool' } });

  // --- Subject variants (the core KPM modeling decision) -------------------
  type VariantSpec = {
    subjectId: string;
    versionId: string;
    level: string;
    schoolType: string;
    language: string;
    dlpMode: string;
    assessmentMode?: string;
    label: string;
  };
  const variantSpecs: VariantSpec[] = [
    { subjectId: preMath.id, versionId: preschool.id, level: 'PRESCHOOL', schoolType: 'PRIVATE', language: 'BM', dlpMode: 'NONE', label: 'Preschool Numeracy' },
    { subjectId: math.id, versionId: kssr.id, level: 'PRIMARY', schoolType: 'SK', language: 'BM', dlpMode: 'NONE', label: 'Y1 Math SK (BM)' },
    { subjectId: math.id, versionId: kssr.id, level: 'PRIMARY', schoolType: 'SJKC', language: 'ZH', dlpMode: 'NONE', label: 'Y1 Math SJKC (ZH)' },
    { subjectId: math.id, versionId: kssr.id, level: 'PRIMARY', schoolType: 'SJKT', language: 'TA', dlpMode: 'NONE', label: 'Y1 Math SJKT (TA)' },
    { subjectId: math.id, versionId: kssr.id, level: 'PRIMARY', schoolType: 'SK', language: 'EN', dlpMode: 'DLP_SUBJECT_VARIANT', assessmentMode: 'BILINGUAL', label: 'Y1 Math SK (DLP/EN)' },
    { subjectId: english.id, versionId: kssr.id, level: 'PRIMARY', schoolType: 'SK', language: 'EN', dlpMode: 'NONE', label: 'Y1 English' },
    { subjectId: science.id, versionId: kssm.id, level: 'LOWER_SECONDARY', schoolType: 'SMK', language: 'BM', dlpMode: 'NONE', label: 'Form 1 Science (BM)' },
    { subjectId: science.id, versionId: kssm.id, level: 'LOWER_SECONDARY', schoolType: 'SMK', language: 'EN', dlpMode: 'DLP_SUBJECT_VARIANT', assessmentMode: 'BILINGUAL', label: 'Form 1 Science (DLP/EN)' },
    { subjectId: math.id, versionId: kssm.id, level: 'UPPER_SECONDARY', schoolType: 'SMK', language: 'BM', dlpMode: 'NONE', label: 'Form 4 Math (BM)' },
    { subjectId: math.id, versionId: kssm.id, level: 'UPPER_SECONDARY', schoolType: 'SMK', language: 'EN', dlpMode: 'DLP_SUBJECT_VARIANT', assessmentMode: 'BILINGUAL', label: 'Form 4 Math (DLP/EN)' },
  ];

  const variants: Record<string, { id: string; spec: VariantSpec }> = {};
  for (const spec of variantSpecs) {
    const v = await prisma.subjectVariant.create({
      data: {
        subjectId: spec.subjectId,
        curriculumVersionId: spec.versionId,
        level: spec.level as never,
        schoolType: spec.schoolType as never,
        language: spec.language as never,
        dlpMode: spec.dlpMode as never,
        assessmentMode: (spec.assessmentMode ?? 'MONOLINGUAL') as never,
      },
    });
    variants[spec.label] = { id: v.id, spec };
  }

  // --- Learning standards + lessons + activities + RAG chunks --------------
  const y1MathSK = variants['Y1 Math SK (BM)'];
  await seedStandardWithLesson({
    variant: y1MathSK,
    versionCode: 'KSSR-2017',
    strand: 'Nombor dan Operasi',
    contentCode: '1.1',
    learningCode: '1.1.1',
    perfCode: 'TP4',
    title: 'Membilang nombor 0 hingga 100',
    lessonTitle: 'Membilang hingga 100',
    lessonBody:
      'Kita boleh membilang objek satu demi satu. Untuk nombor besar, kumpulkan dalam puluh. Contoh: 2 puluh dan 3 sa ialah 23. Menambah 2 + 3 memberi 5.',
    studentId: student.id,
  });

  const y1Eng = variants['Y1 English'];
  await seedStandardWithLesson({
    variant: y1Eng,
    versionCode: 'KSSR-2017',
    strand: 'Reading',
    contentCode: '2.1',
    learningCode: '2.1.1',
    perfCode: 'TP3',
    title: 'Recognise and read CVC words',
    lessonTitle: 'Reading CVC words',
    lessonBody:
      'A CVC word has a consonant, a vowel, then a consonant — like "cat", "dog", "sun". Sound each letter, then blend them together to read the whole word.',
    studentId: student.id,
  });

  const f1Sci = variants['Form 1 Science (BM)'];
  await seedStandardWithLesson({
    variant: f1Sci,
    versionCode: 'KSSM-2017',
    strand: 'Pengenalan kepada Sains',
    contentCode: '1.2',
    learningCode: '1.2.3',
    perfCode: 'TP4',
    title: 'Langkah-langkah dalam penyiasatan saintifik',
    lessonTitle: 'Kaedah saintifik',
    lessonBody:
      'Penyiasatan saintifik bermula dengan pemerhatian, kemudian hipotesis, eksperimen, pengumpulan data, dan kesimpulan. Pemboleh ubah dimanipulasi dan bergerak balas perlu dikenal pasti.',
    studentId: student.id,
  });

  const f4Math = variants['Form 4 Math (BM)'];
  await seedStandardWithLesson({
    variant: f4Math,
    versionCode: 'KSSM-2017',
    strand: 'Fungsi dan Persamaan',
    contentCode: '3.1',
    learningCode: '3.1.2',
    perfCode: 'TP5',
    title: 'Menyelesaikan persamaan kuadratik',
    lessonTitle: 'Persamaan kuadratik',
    lessonBody:
      'Persamaan kuadratik berbentuk ax^2 + bx + c = 0. Boleh diselesaikan dengan pemfaktoran, penyempurnaan kuasa dua, atau rumus kuadratik x = (-b ± √(b²-4ac)) / 2a.',
    studentId: student.id,
  });

  // --- Enrollment + study plan + subscription ------------------------------
  const enrollment = await prisma.enrollment.create({
    data: {
      studentId: student.id,
      schoolProfileId: skPrimaryProfile!.id,
      subjectVariantId: y1MathSK.id,
      studyPlans: { create: { pacingMode: 'self_paced', weeklyTargetMinutes: 120 } },
    },
  });
  console.log(`Enrollment ${enrollment.id} created`);

  const subscription = await prisma.subscription.create({
    data: {
      householdId: household.id,
      provider: 'billplz',
      planCode: 'family_monthly',
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
    },
  });
  await prisma.invoice.create({
    data: {
      subscriptionId: subscription.id,
      invoiceNo: 'INV-0001',
      subtotal: 49,
      tax: 0,
      total: 49,
      status: 'paid',
    },
  });

  // --- Sample tutor conversation with citations ----------------------------
  const firstChunk = await prisma.embeddingChunk.findFirst({ where: { lessonId: { not: null } } });
  const tutorSession = await prisma.tutorSession.create({
    data: { studentId: student.id, provider: 'mock', mode: 'explain' },
  });
  await prisma.tutorMessage.create({
    data: { tutorSessionId: tutorSession.id, authorType: 'STUDENT', content: 'Apa itu 2 + 3?' },
  });
  await prisma.tutorMessage.create({
    data: {
      tutorSessionId: tutorSession.id,
      authorType: 'ASSISTANT',
      content:
        'Menambah 2 + 3 bermaksud menggabungkan 2 objek dengan 3 objek, jadi jumlahnya 5.\n\n**Takeaway:** 2 + 3 = 5.\n**Next step:** Cuba 4 + 3.',
      masterySignal: 'MEDIUM',
      needsReview: false,
      retrievalMetadata: { chunkIds: firstChunk ? [firstChunk.id] : [] },
      citations: firstChunk
        ? { create: { sourceType: 'embedding_chunk', sourceId: firstChunk.id, locator: firstChunk.lessonId } }
        : undefined,
      moderationEvents: { create: { stage: 'post', policyResult: 'PASS', scores: {} } },
    },
  });

  console.log('\n✓ Seed complete. Demo logins:');
  console.log('  Parent:  parent@demo.my  / parent1234');
  console.log('  Admin:   admin@demo.my   / admin1234');
  console.log('  Student: (login via parent) / student1234');
}

// Creates a learning standard + lesson (blocks + activity) + a progress record
// + an embedding chunk with a (mock) vector for RAG.
async function seedStandardWithLesson(args: {
  variant: { id: string; spec: { language: string; schoolType: string; dlpMode: string } };
  versionCode: string;
  strand: string;
  contentCode: string;
  learningCode: string;
  perfCode: string;
  title: string;
  lessonTitle: string;
  lessonBody: string;
  studentId: string;
}) {
  const standard = await prisma.learningStandard.create({
    data: {
      subjectVariantId: args.variant.id,
      strand: args.strand,
      contentStandardCode: args.contentCode,
      learningStandardCode: args.learningCode,
      performanceStandardCode: args.perfCode,
      title: args.title,
    },
  });

  const lesson = await prisma.lesson.create({
    data: {
      learningStandardId: standard.id,
      slug: `${args.versionCode}-${args.learningCode}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: args.lessonTitle,
      status: 'PUBLISHED',
      estimatedMinutes: 15,
      blocks: {
        create: [
          { blockType: 'text', sortOrder: 0, payload: { markdown: args.lessonBody } },
          { blockType: 'text', sortOrder: 1, payload: { markdown: `Latihan: ${args.title}` } },
        ],
      },
      activities: {
        create: {
          activityType: 'quiz',
          difficulty: 1,
          config: {
            items: [
              { id: 'q1', type: 'mcq', prompt: '2 + 3 = ?', options: ['4', '5', '6'], answer: '5', autoMark: true },
            ],
          },
        },
      },
    },
  });

  await prisma.progressRecord.create({
    data: {
      studentId: args.studentId,
      learningStandardId: standard.id,
      masteryScore: 60,
      currentTahapPenguasaan: '4',
      evidenceSummary: { lastScore: 60, lastBand: 'MEDIUM' },
    },
  });

  // Embedding chunk for RAG, with denormalized filter dims + a mock vector.
  const chunk = await prisma.embeddingChunk.create({
    data: {
      lessonId: lesson.id,
      subjectVariantId: args.variant.id,
      curriculumVersionCode: args.versionCode,
      schoolType: args.variant.spec.schoolType as never,
      language: args.variant.spec.language as never,
      dlpMode: args.variant.spec.dlpMode as never,
      content: args.lessonBody,
      tokenCount: args.lessonBody.split(/\s+/).length,
    },
  });

  // Write the vector via raw SQL (Prisma can't set vector columns). Tolerated
  // to fail if db:vector hasn't been run yet.
  try {
    const [vec] = await embedder.embed([args.lessonBody]);
    await prisma.$executeRawUnsafe(
      `UPDATE "EmbeddingChunk" SET "embedding" = $1::vector WHERE id = $2`,
      `[${vec.join(',')}]`,
      chunk.id,
    );
  } catch {
    console.warn('  (embedding vector skipped — run db:vector first for RAG)');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
