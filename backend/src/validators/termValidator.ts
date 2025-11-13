import { z } from 'zod';

export const academicTermSchema = z
  .object({
    id: z.string().uuid('Invalid term identifier').optional(),
    name: z.string().trim().min(1, 'Name is required'),
    startsOn: z.string().date('Invalid start date'),
    endsOn: z.string().date('Invalid end date'),
    metadata: z.record(z.string(), z.unknown()).optional()
  })
  .superRefine((value, ctx) => {
    const startsOn = new Date(value.startsOn);
    const endsOn = new Date(value.endsOn);
    if (Number.isNaN(startsOn.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['startsOn'],
        message: 'Invalid start date'
      });
    }
    if (Number.isNaN(endsOn.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsOn'],
        message: 'Invalid end date'
      });
    }
    if (!Number.isNaN(startsOn.getTime()) && !Number.isNaN(endsOn.getTime()) && startsOn > endsOn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsOn'],
        message: 'End date must be after the start date'
      });
    }
  });

export const classSchema = z
  .object({
    id: z.string().uuid('Invalid class identifier').optional(),
    name: z.string().trim().min(1, 'Class name required'),
    description: z.string().trim().max(255, 'Description too long').optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  })
  .superRefine((value, ctx) => {
    if (value.description === undefined) {
      return;
    }
    if (value.description.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['description'],
        message: 'Description cannot be empty'
      });
    }
  });
