/**
 * Email and SMS send logging/tracking utilities
 * Logs send attempts, successes, and failures for debugging and analytics
 */

import { prisma } from '@/lib/db';

export type SendType = 'email' | 'sms';
export type SendStatus = 'pending' | 'sent' | 'failed' | 'delivered' | 'bounced';

export interface SendLogEntry {
  guest_id?: string;
  event_id: string;
  send_type: SendType;
  status: SendStatus;
  recipient: string;
  subject?: string;
  error_message?: string;
  provider?: string;
  provider_message_id?: string;
  metadata?: Record<string, unknown>;
}

export async function logSendAttempt(entry: SendLogEntry): Promise<void> {
  try {
    await prisma.sendLog.create({
      data: {
        guest_id: entry.guest_id || null,
        event_id: entry.event_id,
        send_type: entry.send_type,
        status: entry.status,
        recipient: entry.recipient,
        subject: entry.subject || null,
        error_message: entry.error_message || null,
        provider: entry.provider || null,
        provider_message_id: entry.provider_message_id || null,
        metadata: entry.metadata || null,
      },
    });
  } catch (error) {
    console.error('Failed to log send attempt:', error);
  }
}

export async function updateSendStatus(
  logId: string,
  status: SendStatus,
  errorMessage?: string,
): Promise<void> {
  try {
    await prisma.sendLog.update({
      where: { id: logId },
      data: {
        status,
        error_message: errorMessage,
      },
    });
  } catch (error) {
    console.error('Failed to update send status:', error);
  }
}

export async function logSendSuccess(
  eventId: string,
  sendType: SendType,
  recipient: string,
  options: {
    guestId?: string;
    subject?: string;
    provider?: string;
    providerMessageId?: string;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<void> {
  await logSendAttempt({
    event_id: eventId,
    guest_id: options.guestId,
    send_type: sendType,
    status: 'sent',
    recipient,
    subject: options.subject,
    provider: options.provider,
    provider_message_id: options.providerMessageId,
    metadata: options.metadata,
  });
}

export async function logSendFailure(
  eventId: string,
  sendType: SendType,
  recipient: string,
  errorMessage: string,
  options: {
    guestId?: string;
    subject?: string;
    provider?: string;
  } = {},
): Promise<void> {
  console.error(`[${sendType.toUpperCase()} FAILED] ${recipient}: ${errorMessage}`);

  await logSendAttempt({
    event_id: eventId,
    guest_id: options.guestId,
    send_type: sendType,
    status: 'failed',
    recipient,
    subject: options.subject,
    error_message: errorMessage,
    provider: options.provider,
  });
}

export async function getEventSendStats(eventId: string): Promise<{
  total: number;
  sent: number;
  failed: number;
  pending: number;
  byType: Record<SendType, { sent: number; failed: number }>;
}> {
  const logs = await prisma.sendLog.findMany({
    where: { event_id: eventId },
    select: { send_type: true, status: true },
  });

  const stats = {
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0,
    byType: {
      email: { sent: 0, failed: 0 },
      sms: { sent: 0, failed: 0 },
    },
  };

  for (const log of logs) {
    stats.total++;

    if (log.status === 'sent' || log.status === 'delivered') {
      stats.sent++;
      stats.byType[log.send_type as SendType].sent++;
    } else if (log.status === 'failed') {
      stats.failed++;
      stats.byType[log.send_type as SendType].failed++;
    } else if (log.status === 'pending') {
      stats.pending++;
    }
  }

  return stats;
}
