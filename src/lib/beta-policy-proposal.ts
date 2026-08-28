import { z } from "zod";
import { betaAcceptanceThresholdsSchema } from "@/lib/beta-acceptance-decision";

export const betaPolicyProposalSchema = z.object({
  schemaVersion: z.literal(1),
  cohortVersion: z.string().regex(/^[a-z0-9][a-z0-9-]{2,63}$/),
  status: z.literal("proposed"),
  preparedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ownerDecision: z.literal("pending"),
  evidenceBoundary: z.string().min(20).max(500),
  thresholds: betaAcceptanceThresholdsSchema,
}).strict();

export function validateBetaPolicyProposal(input: unknown) {
  return betaPolicyProposalSchema.safeParse(input);
}
