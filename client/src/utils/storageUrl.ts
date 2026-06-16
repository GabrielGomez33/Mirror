// src/utils/storageUrl.ts
// Shared utility for building secure storage retrieval URLs.
// Uses the server's /mirror/api/storage/retrieve/:userId/:tier/:filename endpoint.

import { getToken } from './token';

/**
 * Tier used for a given media type.
 * Must stay in sync with the server's TYPE_TO_TIER mapping in storageController.ts.
 */
export type StorageTier = 'tier1' | 'tier2' | 'tier3';

const PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.gif', '.tiff']);
const VOICE_EXTENSIONS = new Set(['.webm', '.mp3', '.m4a', '.ogg', '.wav']);

/**
 * Infer storage tier from a filename extension.
 * Photos → tier1, voice/audio → tier2, everything else → tier3.
 */
export function inferTierFromFilename(filename: string): StorageTier {
  const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')).toLowerCase() : '';
  if (PHOTO_EXTENSIONS.has(ext)) return 'tier1';
  if (VOICE_EXTENSIONS.has(ext)) return 'tier2';
  return 'tier3';
}

/**
 * Build a secure storage retrieval URL from userId, tier, and filename.
 *
 * Security checks:
 * - Rejects nullish / empty paths
 * - Blocks path traversal (..)
 * - Blocks absolute paths and protocol-relative URLs
 * - Only allows same-origin full URLs
 * - Appends JWT token as query param (required for <img>/<audio> elements)
 *
 * @param filename  - The filename returned by the storage API (e.g., "abc123.jpg")
 * @param userId    - The owning user's ID
 * @param tier      - Explicit tier override. If omitted, inferred from filename extension.
 * @returns         - Full URL string, or null if the input is invalid.
 */
export function buildStorageRetrieveUrl(
  filename: string | null | undefined,
  userId: number | string,
  tier?: StorageTier,
): string | null {
  if (!filename || typeof filename !== 'string') return null;

  const trimmed = filename.trim();
  if (!trimmed) return null;

  // Block path traversal
  if (trimmed.includes('..')) return null;

  // Block absolute paths and protocol-relative URLs
  if (trimmed.startsWith('/') || trimmed.startsWith('\\') || trimmed.startsWith('//')) return null;

  // Allow full URLs only from same origin (pass through if already a full URL)
  if (trimmed.startsWith('http')) {
    try {
      const base = (import.meta as any).env?.VITE_API_URL || window.location.origin;
      if (new URL(trimmed).origin !== new URL(base).origin) return null;
      return trimmed;
    } catch {
      return null;
    }
  }

  const resolvedTier = tier || inferTierFromFilename(trimmed);
  const base = (import.meta as any).env?.VITE_API_URL || '';
  // Read via the storage-backend-aware accessor: tokens live in sessionStorage
  // when "Remember Me" is off, so a raw localStorage read would miss them and
  // produce an unauthenticated URL (401 for <img>/<audio> media).
  const token = getToken('mirror_jwt');
  const authParam = token ? `?token=${encodeURIComponent(token)}` : '';

  return `${base}/mirror/api/storage/retrieve/${encodeURIComponent(String(userId))}/${resolvedTier}/${encodeURIComponent(trimmed)}${authParam}`;
}