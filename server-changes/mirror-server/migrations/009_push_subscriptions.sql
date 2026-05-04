-- ============================================================================
-- PHASE 4: WEB PUSH SUBSCRIPTIONS
-- ============================================================================
-- File: migrations/009_push_subscriptions.sql
-- Description: Stores per-device Web Push subscriptions for authenticated
--              users. One row per (user_id, endpoint). A single user with
--              multiple devices (phone + laptop + tablet) gets multiple rows.
--
-- The keys (p256dh, auth) are the public-key material the browser hands us
-- in PushSubscription.toJSON(). They are NOT secrets — they only let our
-- server encrypt push payloads that the user's specific device can decrypt.
-- The endpoint URL points to the user's push service (FCM, APNs, Mozilla),
-- which is what relays our notifications to the device.
--
-- expired_at is set when the push service returns 410 Gone (subscription
-- revoked or device wiped). We soft-delete first, then a periodic job can
-- prune rows older than 30 days. This avoids racing with concurrent
-- push attempts.
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,

  user_id INT NOT NULL,

  -- Push service endpoint (FCM, APNs, Mozilla autopush). Unique per device.
  -- TEXT, not VARCHAR — endpoints can exceed 500 chars and have no spec'd max.
  endpoint TEXT NOT NULL,
  endpoint_hash CHAR(64) NOT NULL,  -- SHA-256 of endpoint, for the unique index

  -- ECDH public key (P-256) the browser generated for this subscription.
  -- Used to encrypt payloads under RFC 8291.
  p256dh VARCHAR(255) NOT NULL,

  -- Auth secret the browser generated. Mixed into the encryption nonce.
  auth_secret VARCHAR(255) NOT NULL,

  -- Useful for debugging "why isn't this device receiving?" tickets.
  user_agent VARCHAR(500) DEFAULT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Set by pushService when the push service returns 404/410. The row is
  -- kept around briefly for audit, then pruned by a periodic job.
  expired_at TIMESTAMP NULL DEFAULT NULL,

  -- Bookkeeping for monitoring.
  last_success_at TIMESTAMP NULL DEFAULT NULL,
  last_error TEXT DEFAULT NULL,
  failure_count INT NOT NULL DEFAULT 0,

  -- One row per (user, endpoint). Browsers can re-issue the same endpoint
  -- after permission toggle; the upsert in pushService relies on this.
  UNIQUE KEY uniq_user_endpoint (user_id, endpoint_hash),

  -- Fan-out is "all subscriptions for user X that aren't expired" — index
  -- supports it directly.
  KEY idx_user_active (user_id, expired_at),

  -- For periodic cleanup of long-expired rows.
  KEY idx_expired_at (expired_at),

  CONSTRAINT fk_push_subs_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
