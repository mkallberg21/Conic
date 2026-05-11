import { z } from "zod";

export const partyTypeSchema = z.enum(["brand", "creator"]);

export const createAgreementSchema = z.object({
  title: z.string().min(4),
  scope: z.string().min(10),
  amountCents: z.number().int().positive(),
  brandName: z.string().min(2),
  brandEmail: z.string().email(),
  creatorName: z.string().min(2),
  creatorEmail: z.string().email()
});

export const submitDeliverableSchema = z.object({
  description: z.string().min(4),
  proofUrl: z.string().url()
});

export const createContactLeadSchema = z.object({
  interestedAs: partyTypeSchema,
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  message: z.string().min(8)
});

export type CreateAgreementInput = z.infer<typeof createAgreementSchema>;
export type SubmitDeliverableInput = z.infer<typeof submitDeliverableSchema>;
export type CreateContactLeadInput = z.infer<typeof createContactLeadSchema>;
