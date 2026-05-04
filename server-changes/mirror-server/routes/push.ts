// ============================================================================
// PUSH NOTIFICATION ROUTES
// ============================================================================
// File: routes/push.ts
// Description: Endpoints the client calls to manage Web Push subscriptions.
//              Mounted at /mirror/api/push.
//
// ROUTES
//   GET    /vapid-public-key   — public, no auth (used by client before
//                                 it can ask the user for permission).
//   POST   /subscribe          — auth required; persists a PushSubscription.
//   DELETE /subscribe          — auth required; removes a subscription.
//
// AUTHENTICATION
//   This file relies on the parent index.ts mounting AuthMiddleware.verifyToken
//   in front of /subscribe paths (see mount example in
//   server-changes/mirror-server/README.md). The vapid-public-key route is
//   intentionally public so a logged-out user can hit it during onboarding.
// ============================================================================

import express, { Request, Response, RequestHandler } from 'express';
import AuthMiddleware from '../middleware/authMiddleware';
import { pushService, getVapidPublicKey } from '../services/pushService';
import { Logger } from '../utils/logger';

const logger = new Logger('PushRoutes');
const router = express.Router();

// ============================================================================
// GET /vapid-public-key
// ============================================================================
// The browser needs this to call PushManager.subscribe({ applicationServerKey }).
// It is NOT a secret — it identifies your server to push services.
router.get('/vapid-public-key', ((req: Request, res: Response) => {
  const key = getVapidPublicKey();
  if (!key) {
    res.status(503).json({ error: 'Push not configured', code: 'PUSH_DISABLED' });
    return;
  }
  res.json({ publicKey: key });
}) as RequestHandler);

// ============================================================================
// POST /subscribe   { endpoint, keys: { p256dh, auth } }
// ============================================================================
// Idempotent — re-subscribing the same device updates the row in place.
router.post(
  '/subscribe',
  AuthMiddleware.verifyToken as RequestHandler,
  (async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { endpoint, keys } = req.body ?? {};

    if (
      typeof endpoint !== 'string' ||
      !endpoint.startsWith('https://') ||
      !keys ||
      typeof keys.p256dh !== 'string' ||
      typeof keys.auth !== 'string'
    ) {
      res.status(400).json({
        error: 'Invalid subscription payload',
        code: 'INVALID_SUBSCRIPTION',
      });
      return;
    }

    try {
      const userAgent = (req.headers['user-agent'] || '').toString().slice(0, 500) || null;
      await pushService.upsert(userId, { endpoint, keys }, userAgent);
      res.status(201).json({ ok: true });
    } catch (err) {
      logger.error('Failed to upsert push subscription', err as Error, { userId });
      res.status(500).json({ error: 'Failed to save subscription' });
    }
  }) as RequestHandler,
);

// ============================================================================
// DELETE /subscribe   { endpoint }
// ============================================================================
// Called when the user toggles notifications off in settings. Client should
// also call PushSubscription.unsubscribe() locally; this route just cleans
// up our DB so we stop fanning out to a dead endpoint.
router.delete(
  '/subscribe',
  AuthMiddleware.verifyToken as RequestHandler,
  (async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { endpoint } = req.body ?? {};
    if (typeof endpoint !== 'string' || !endpoint) {
      res.status(400).json({ error: 'endpoint required' });
      return;
    }

    try {
      await pushService.remove(userId, endpoint);
      res.json({ ok: true });
    } catch (err) {
      logger.error('Failed to remove push subscription', err as Error, { userId });
      res.status(500).json({ error: 'Failed to remove subscription' });
    }
  }) as RequestHandler,
);

export default router;
