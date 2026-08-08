import { z } from "zod";

export const aiAnnouncementDraftSchema = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  cautions: z.array(z.string().min(1).max(300)).max(10),
}).strict();

export type AiAnnouncementDraft = z.infer<typeof aiAnnouncementDraftSchema>;
