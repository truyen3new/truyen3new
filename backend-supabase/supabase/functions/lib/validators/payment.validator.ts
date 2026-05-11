import { z } from 'zod';

export const PaymentWebhookSchema = z.object({
  type: z.literal('payment_webhook'),
  data: z.object({
    user_id: z.string().uuid('user_id must be a valid UUID'),
    amount: z.number().nonnegative().optional().default(0),
    provider: z.string().min(1).optional().default('unknown'),
    provider_event: z.any().optional().nullable(),
  }),
});

export const DailyCheckinSchema = z.object({
  type: z.literal('daily_checkin'),
  data: z.object({
    user_id: z.string().uuid('user_id must be a valid UUID'),
  }),
});

export const PaymentEventSchema = z.discriminatedUnion('type', [PaymentWebhookSchema, DailyCheckinSchema]);

export type PaymentEvent = z.infer<typeof PaymentEventSchema>;
