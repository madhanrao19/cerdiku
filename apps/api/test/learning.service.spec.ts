import { describe, it, expect } from 'vitest';
import { LearningService } from '../src/learning/learning.service.js';

// Unit test for attempt submission + auto-marking + progress roll-up, using a
// minimal fake PrismaService (no DB needed).
describe('LearningService.submitAttempt', () => {
  function makeService() {
    const progressUpserts: unknown[] = [];
    const fakePrisma = {
      attempt: {
        findUnique: async () => ({
          id: 'a1',
          studentId: 's1',
          activity: {
            lessonId: 'l1',
            config: {
              items: [
                { id: 'q1', answer: '5', autoMark: true },
                { id: 'q2', answer: '7', autoMark: true },
              ],
            },
          },
        }),
        update: async ({ data }: { data: unknown }) => ({ id: 'a1', ...(data as object) }),
      },
      lesson: { findUnique: async () => ({ learningStandardId: 'ls1' }) },
      progressRecord: {
        upsert: async (args: unknown) => {
          progressUpserts.push(args);
          return {};
        },
      },
    };
    const service = new LearningService(fakePrisma as never);
    return { service, progressUpserts };
  }

  it('scores objective answers and assigns a mastery band', async () => {
    const { service, progressUpserts } = makeService();
    const result = await service.submitAttempt('a1', 's1', {
      responses: [
        { questionId: 'q1', answer: '5' },
        { questionId: 'q2', answer: '0' }, // wrong
      ],
    });
    expect(result.score).toBe(50); // 1 of 2 correct
    expect(result.masteryBand).toBe('MEDIUM');
    expect(progressUpserts).toHaveLength(1);
  });

  it('marks full score as HIGH mastery', async () => {
    const { service } = makeService();
    const result = await service.submitAttempt('a1', 's1', {
      responses: [
        { questionId: 'q1', answer: '5' },
        { questionId: 'q2', answer: '7' },
      ],
    });
    expect(result.score).toBe(100);
    expect(result.masteryBand).toBe('HIGH');
  });

  it('rejects attempts that belong to another student', async () => {
    const { service } = makeService();
    await expect(
      service.submitAttempt('a1', 'someone-else', { responses: [] }),
    ).rejects.toThrow();
  });
});
