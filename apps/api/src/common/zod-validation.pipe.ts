import { PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';

// Bridges @kpm/types Zod schemas into Nest's pipe system so the API and the
// frontend validate against the exact same contract.
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}
  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}
