/**
 * Email and SMS send logging/tracking utilities
 * Logs send attempts, successes, and failures for debugging and analytics
 */

import { query } from '@/lib/db/client';

export type SendType = 'email' | 'sms';
export type SendStatus = 'pending' | 'sent' | 'failed' | 'delivered' | 'bounced';

export interface SendLogEntry {
  guest_id?: string;
  event_id: string;
  send_type: SendType;
  status: SendStatus;
  recipient: string; // email or phone
  subject?: string;
  error_message?: string;
  provider?: string; // 'mailgun' | 'twilio'
  provider_message_id?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log a send attempt to the database
 * Requires a send_logs table (see migration below)
 */
export async function logSendAttempt(entry: SendLogEntry): Promise<void> {
  try {
    await query(
      `INSERT INTO send_logs (guest_id, event_id, send_type, status, recipient, subject, error_message, provider, provider_message_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        entry.guest_id ?? null,
        entry.event_id,
        entry.send_type,
        entry.status,
        entry.recipient,
        entry.subject ?? null,
        entry.error_message ?? null,
        entry.provider ?? null,
        entry.provider_message_id ?? null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        new Date().toISOString(),
      ]
    );
  } catch (error) {
    // Don't throw - logging failures shouldn't break the main flow
    console.error('Failed to log send attempt:', error);
  }
}

/**
 * Update the status of a logged send (e.g., after webhook callback)
 */
export async function updateSendStatus(
  logId: string,
  status: SendStatus,
  errorMessage?: string
): Promise<void> {
  try {
    await query(
      'UPDATE send_logs SET status = $1, error_message = $2, updated_at = $3 WHERE id = $4',
      [status, errorMessage ?? null, new Date().toISOString(), logId]
    );
  } catch (error) {
    console.error('Failed to update send status:', error);
  }
}

/**
 * Log a successful send
 */
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
  } = {}
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

/**
 * Log a failed send
 */
export async function logSendFailure(
  eventId: string,
  sendType: SendType,
  recipient: string,
  errorMessage: string,
  options: {
    guestId?: string;
    subject?: string;
    provider?: string;
  } = {}
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

/**
 * Get send statistics for an event
 */
export async function getEventSendStats(eventId: string): Promise<{
  total: number;
  sent: number;
  failed: number;
  pending: number;
  byType: Record<SendType, { sent: number; failed: number }>;
}> {
  const logs = await query<{ send_type: string; status: string }>(
    'SELECT send_type, status FROM send_logs WHERE event_id = $1',
    [eventId]
  );

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

  for (const log of logs || []) {
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

/**
 * Migration to create send_logs table:
 *
 * ```sql
 * CREATE TABLE send_logs (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
 *   event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
 *   send_type TEXT NOT NULL CHECK (send_type IN ('email', 'sms')),
 *   status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'delivered', 'bounced')),
 *   recipient TEXT NOT NULL, -- email or phone
 *   subject TEXT,
 *   error_message TEXT,
 *   provider TEXT,
 *   provider_message_id TEXT,
 *   metadata JSONB,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * CREATE INDEX idx_send_logs_event ON send_logs(event_id);
 * CREATE INDEX idx_send_logs_guest ON send_logs(guest_id);
 * CREATE INDEX idx_send_logs_status ON send_logs(status);
 * CREATE INDEX idx_send_logs_created ON send_logs(created_at);
 *
 * ALTER TABLE send_logs ENABLE ROW LEVEL SECURITY;
 *
 * CREATE POLICY "Users can view own event send logs" ON send_logs
 *   FOR SELECT USING (
 *     event_id IN (SELECT id FROM events WHERE user_id = auth.uid())
 *   );
 * ```
 */
