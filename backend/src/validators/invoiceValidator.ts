import { z } from 'zod';

export const feeItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.number().positive('Amount must be positive'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const invoiceSchema = z.object({
  studentId: z.string().uuid('studentId must be a UUID'),
  dueDate: z.string().datetime().optional(),
  currency: z.string().default('USD'),
  items: z.array(feeItemSchema).min(1, 'At least one fee item is required'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
