// src/utils/token.ts
//
// Storage-backend-aware token helpers.
//
// The Remember Me checkbox on Login.tsx now controls more than which email
// gets re-suggested — it decides whether the auth tokens survive a browser
// session. Spec:
//
//   Remember Me CHECKED:
//     Tokens live in localStorage. They persist across browser restarts
//     until the server's refresh-token expiry (currently 7 days) runs out
//     or the user explicitly logs out.
//
//   Remember Me UNCHECKED:
//     Tokens live in sessionStorage. They die the moment the user closes
//     the last tab/window for this origin. A refresh inside the same
//     session keeps them; a fresh browser launch starts at the login
//     screen even though the refresh token might technically still be
//     valid server-side. This is the conventional "this is a shared
//     computer" semantics — it matches what banks and password managers
//     do.
//
// How storage backend is decided:
//   The Login submit handler writes `mirror_persistent` to localStorage
//   ('1' / '0') right before it calls AuthContext.login. setToken /
//   getToken / clearToken read that flag on every call and pick the
//   matching Storage object.
//
// Backwards-compat: existing accounts whose tokens are already in
// localStorage and have no `mirror_persistent` flag set → tokenStore()
// defaults to localStorage, so nothing breaks on upgrade. They behave as
// if Remember Me had been checked, which matches the historical default.
//
// clearToken() wipes from BOTH storages every time, so a stray write
// during a flag flip can't leave a ghost token behind.

export type StoredUserInfo = {
  userId: number;
  username: string;
  email: string;
  lastLogin?: string;
};

const PERSIST_FLAG_KEY = 'mirror_persistent';

type SlotName = 'mirror_jwt' | 'refreshToken' | 'userInfo';

const slotKey: Record<SlotName, string> = {
  mirror_jwt: 'mirror_jwt',
  refreshToken: 'refreshToken',
  userInfo: 'userInfo',
};

// The persistence flag is itself stored in localStorage — it needs to
// survive a browser restart so the next visit knows which storage to
// look in. Reading the flag is wrapped in try/catch because Safari
// private-mode throws on every localStorage access.
function isPersistent(): boolean {
  try {
    const flag = localStorage.getItem(PERSIST_FLAG_KEY);
    // Default to true so accounts that existed before this change keep
    // working — their tokens are in localStorage, no flag, but we want
    // those reads to land in localStorage.
    if (flag === null) return true;
    return flag === '1';
  } catch {
    return true;
  }
}

function tokenStore(): Storage | null {
  try {
    return isPersistent() ? localStorage : sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Tell future setToken/getToken calls which storage to use. Call this
 * BEFORE the login fetch fires so the response tokens land in the right
 * place.
 */
export function setRememberMe(persistent: boolean): void {
  try {
    localStorage.setItem(PERSIST_FLAG_KEY, persistent ? '1' : '0');
  } catch {
    /* private mode — non-fatal; tokens just go to localStorage by default */
  }
}

export function getRememberMe(): boolean {
  return isPersistent();
}

export function setToken(token: string, typeOfToken: SlotName | string = 'mirror_jwt'): void {
  if (!(typeOfToken in slotKey)) return;
  const store = tokenStore();
  if (!store) return;
  try {
    store.setItem(slotKey[typeOfToken as SlotName], token);
  } catch {
    /* quota / private mode — non-fatal */
  }
}

export function getToken(typeOfToken: SlotName | string = 'mirror_jwt'): string | null {
  if (!(typeOfToken in slotKey)) return null;
  const key = slotKey[typeOfToken as SlotName];
  // Read primary storage first, then fall back to the OTHER storage.
  // This covers the edge case where the user logged in once with
  // Remember Me ON (token in localStorage), logged out cleanly, logged
  // back in with Remember Me OFF — and we want session continuity if
  // somehow a stale token from one side is the only one we have. It
  // also covers backwards-compat reads for pre-flag accounts.
  try {
    const primary = tokenStore()?.getItem(key);
    if (primary) return primary;
  } catch { /* try fallback below */ }
  try {
    const fallback = (isPersistent() ? sessionStorage : localStorage).getItem(key);
    return fallback;
  } catch {
    return null;
  }
}

export function clearToken(typeOfToken: SlotName | string = 'mirror_jwt'): void {
  if (!(typeOfToken in slotKey)) return;
  const key = slotKey[typeOfToken as SlotName];
  // Always wipe from BOTH storages — defends against a Remember-Me-flag
  // flip leaving a ghost token behind in the other storage.
  try { localStorage.removeItem(key); } catch { /* noop */ }
  try { sessionStorage.removeItem(key); } catch { /* noop */ }
}

export function getUserInfo(): StoredUserInfo | null {
  const raw = getToken('userInfo');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const userId = Number(parsed?.userId);
    if (!isNaN(userId) && userId > 0) {
      return { ...parsed, userId } as StoredUserInfo;
    }
    return null;
  } catch {
    return null;
  }
}