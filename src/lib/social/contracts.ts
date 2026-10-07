import { z } from 'zod';

export const settingsSchema = z.object({
  guests_enabled: z.boolean(), reactions_enabled: z.boolean(),
  polls_enabled: z.boolean(), photos_enabled: z.boolean(),
  countdown_enabled: z.boolean(), photo_approval: z.boolean(),
}).strict();
export type SocialSettings = z.infer<typeof settingsSchema>;
export const DEFAULT_SOCIAL_SETTINGS: SocialSettings = {
  guests_enabled: false, reactions_enabled: false, polls_enabled: false,
  photos_enabled: false, countdown_enabled: false, photo_approval: true,
};
export const reactionSchema = z.enum(['excited', 'love', 'celebrate']).nullable();
export const pollSchema = z.object({
  question: z.string().trim().min(1).max(200),
  options: z.array(z.string().trim().min(1).max(80)).min(2).max(6),
}).strict().refine(p => new Set(p.options.map(o => o.toLocaleLowerCase())).size === p.options.length,
  { message: 'Use different options.' });
export const guestActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('visibility'), show_name: z.boolean() }).strict(),
  z.object({ action: z.literal('reaction'), reaction: reactionSchema }).strict(),
  z.object({ action: z.literal('vote'), poll_id: z.uuid(), option_index: z.number().int().min(0).max(5) }).strict(),
]);
export const hostActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('settings'), settings: settingsSchema }).strict(),
  z.object({ action: z.literal('poll'), poll: pollSchema }).strict(),
  z.object({ action: z.literal('close_poll'), id: z.uuid(), closed: z.boolean() }).strict(),
  z.object({ action: z.literal('approve_photo'), id: z.uuid() }).strict(),
  z.object({ action: z.literal('delete_photo'), id: z.uuid() }).strict(),
]);
export type SocialPhoto = { id: string; caption: string; approved: boolean; own: boolean };
export type SocialPoll = { id: string; question: string; options: string[]; closed: boolean; counts: number[]; choice: number | null };
export type SocialState = {
  settings: SocialSettings; guests: { name: string }[];
  reactions: Record<string, number>; mine: { show_name: boolean; reaction: string | null };
  polls: SocialPoll[]; photos: SocialPhoto[]; event_date: string | null;
};
