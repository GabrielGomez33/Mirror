// ============================================================================
// WEB PUSH SERVICE
// ============================================================================
// File: services/pushService.ts
// Description: Thin wrapper around the `web-push` library. Handles VAPID
//              setup, fan-out to a user's devices, and pruning of expired
//              subscriptions (410 Gone responses).
//
// USAGE
//   await pushService.send(userId, {
//     title: 'New review on your TruthStream',
//     body: 'Someone left you feedback.',
//     url: '/Mirror/truthstream/received',
//     tag: 'truthstream-review',
//   });
//
// HOW IT WORKS
//   - send() pulls every active subscription for the user, encrypts the
//     payload per RFC 8291 (web-push does the crypto), and POSTs it to the
//     push service endpoint (FCM/APNs/Mozilla).
//   - Push services respond with:
//       201 Created — accepted, will deliver when the device next checks in
//       410 Gone    — subscription revoked; we soft-delete it
//       404         — same; soft-delete
//       413/429     — payload too big / rate limited; log and continue
//       4xx/5xx     — log; don't blow up the caller
//   - Fan-out failures don't propagate. Push is best-effort — your in-app
//     notification system is the source of truth.
//
// ENV VARS REQUIRED (see server-changes/README.md)
//   VAPID_PUBLIC_KEY   — base64url-encoded P-256 public key
//   VAPID_PRIVATE_KEY  — base64url-encoded P-256 private key
//   VAPID_SUBJECT      — mailto: URL the push service can contact you at
// ============================================================================

import webpush, { PushSubscription as WebPushSubscription, SendResult } from 'web-push';
import crypto from 'crypto';
import { DB } from '../db';
import { Logger } from '../utils/logger';

const logger = new Logger('PushService');

// ============================================================================
// PAYLOAD SHAPE
// ============================================================================

/**
 * Payload sent to the service worker's `push` event listener.
 * Keep it small — push services cap at ~4 KB total (encrypted).
 *
 * `tag` lets the SW collapse duplicates: e.g. five replies in a noisy group
 * chat with the same tag will overwrite each other instead of stacking.
 */
export interface PushPayload {
  title: string;
  body: string;
  /** Absolute or root-relative URL the SW navigates to on click. */
  url?: string;
  /** Notification tag for de-duplication on the device. */
  tag?: string;
  /** Notification icon (defaults to /Mirror/pwa-192x192.png in the SW). */
  icon?: string;
  /** Free-form data passed to the SW for deep-link routing. */
  data?: Record<string, unknown>;
}

// ============================================================================
// VAPID INITIALIZATION
// ============================================================================

let initialized = false;

function init(): boolean {
  if (initialized) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    logger.warn('VAPID env vars missing — push disabled', {
      hasPublic: !!publicKey,
      hasPrivate: !!privateKey,
      hasSubject: !!subject,
    });
    return false;
  }

  if (!subject.startsWith('mailto:') && !subject.startsWith('https://')) {
    logger.error('VAPID_SUBJECT must start with mailto: or https://');
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    initialized = true;
    logger.info('Web push initialized');
    return true;
  } catch (err) {
    logger.error('Failed to initialize web-push', err as Error);
    return false;
  }
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

// ============================================================================
// DB ROW SHAPE
// ============================================================================

interface SubscriptionRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth_secret: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function endpointHash(endpoint: string): string {
  return crypto.createHash('sha256').update(endpoint).digest('hex');
}

function rowToWebPushSubscription(row: SubscriptionRow): WebPushSubscription {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth_secret,
    },
  };
}

async function markExpired(subscriptionId: number, reason: string): Promise<void> {
  try {
    await DB.execute(
      `UPDATE push_subscriptions
       SET expired_at = CURRENT_TIMESTAMP,
           last_error = ?
       WHERE id = ? AND expired_at IS NULL`,
      [reason.slice(0, 500), subscriptionId],
    );
  } catch (err) {
    logger.error('Failed to mark subscription expired', err as Error, { subscriptionId });
  }
}

async function recordFailure(subscriptionId: number, message: string): Promise<void> {
  try {
    await DB.execute(
      `UPDATE push_subscriptions
       SET failure_count = failure_count + 1,
           last_error = ?
       WHERE id = ?`,
      [message.slice(0, 500), subscriptionId],
    );
  } catch (err) {
    logger.error('Failed to record push failure', err as Error, { subscriptionId });
  }
}

async function recordSuccess(subscriptionId: number): Promise<void> {
  try {
    await DB.execute(
      `UPDATE push_subscriptions
       SET last_success_at = CURRENT_TIMESTAMP,
           failure_count = 0,
           last_error = NULL
       WHERE id = ?`,
      [subscriptionId],
    );
  } catch {
    // Bookkeeping failures shouldn't break delivery reporting.
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export const pushService = {
  /**
   * Persist a new (or update an existing) push subscription for a user.
   * Idempotent: re-subscribing the same device updates the keys.
   */
  async upsert(
    userId: number,
    sub: WebPushSubscription,
    userAgent: string | null,
  ): Promise<void> {
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      throw new Error('Invalid subscription shape');
    }

    const hash = endpointHash(sub.endpoint);

    await DB.execute(
      `INSERT INTO push_subscriptions
         (user_id, endpoint, endpoint_hash, p256dh, auth_secret, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         p256dh = VALUES(p256dh),
         auth_secret = VALUES(auth_secret),
         user_agent = VALUES(user_agent),
         expired_at = NULL,
         last_error = NULL,
         failure_count = 0`,
      [userId, sub.endpoint, hash, sub.keys.p256dh, sub.keys.auth, userAgent],
    );
  },

  /**
   * Remove a single subscription for a user. Used when the client toggles
   * notifications off, before it calls PushSubscription.unsubscribe().
   */
  async remove(userId: number, endpoint: string): Promise<void> {
    const hash = endpointHash(endpoint);
    await DB.execute(
      `DELETE FROM push_subscriptions
       WHERE user_id = ? AND endpoint_hash = ?`,
      [userId, hash],
    );
  },

  /**
   * Send a push to every active device for a user. Best-effort: failures
   * are logged but never thrown to the caller. Returns counts for metrics.
   */
  async send(
    userId: number,
    payload: PushPayload,
  ): Promise<{ sent: number; failed: number; expired: number }> {
    if (!init()) return { sent: 0, failed: 0, expired: 0 };

    const [rows] = await DB.execute(
      `SELECT id, endpoint, p256dh, auth_secret
       FROM push_subscriptions
       WHERE user_id = ? AND expired_at IS NULL`,
      [userId],
    );
    const subscriptions = rows as SubscriptionRow[];

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0, expired: 0 };
    }

    const body = JSON.stringify(payload);

    let sent = 0;
    let failed = 0;
    let expired = 0;

    const results = await Promise.allSettled(
      subscriptions.map((row) =>
        webpush
          .sendNotification(rowToWebPushSubscription(row), body, { TTL: 60 * 60 * 24 })
          .then<{ row: SubscriptionRow; result: SendResult }>((result) => ({ row, result })),
      ),
    );

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const row = subscriptions[i];

      if (r.status === 'fulfilled') {
        sent++;
        await recordSuccess(row.id);
        continue;
      }

      const err = r.reason as { statusCode?: number; body?: string; message?: string };
      const statusCode = err?.statusCode;

      if (statusCode === 404 || statusCode === 410) {
        expired++;
        await markExpired(row.id, `gone:${statusCode}`);
      } else {
        failed++;
        await recordFailure(row.id, err?.message || `status:${statusCode ?? 'unknown'}`);
        logger.warn('Push send failed', {
          userId,
          subscriptionId: row.id,
          statusCode,
          message: err?.message,
        });
      }
    }

    return { sent, failed, expired };
  },

  /**
   * Periodic cleanup: hard-delete subscriptions that have been expired for
   * more than 30 days. Safe to call from a cron / interval.
   */
  async pruneExpired(olderThanDays = 30): Promise<number> {
    const [result] = await DB.execute(
      `DELETE FROM push_subscriptions
       WHERE expired_at IS NOT NULL
         AND expired_at < (NOW() - INTERVAL ? DAY)`,
      [olderThanDays],
    );
    const affected = (result as { affectedRows?: number }).affectedRows ?? 0;
    if (affected > 0) {
      logger.info(`Pruned ${affected} expired push subscriptions`);
    }
    return affected;
  },
};
