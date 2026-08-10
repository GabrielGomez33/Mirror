# Student Access (Goal #1, L1) — Mirror frontend

Frontend surface for the verified-student free-Premium flow. The backend lives
in `mirror-server` (branch `claude/mirror-frontend-backend-analysis-76mtgl`,
folder `student-access/`) at `/mirror/api/student`.

## Files (complete, at their real paths on this branch)

| Path | Purpose |
|---|---|
| `client/src/services/studentAccessApi.ts` | API client (mirrors `emailVerificationApi.ts`: `getToken`, Bearer, `credentials:'include'`). |
| `client/src/components/paywall/StudentAccessCard.tsx` | Account/upgrade card: school email + **explicit 18+** checkbox → `/request`; friendly per-code errors; hides itself if already active. |
| `client/src/components/paywall/StudentVerifyPage.tsx` | Landing for the emailed link `/students/verify?token=…` → `/verify`. StrictMode double-invoke guarded. |

## Wiring

1. Add the route (react-router v7):
   ```tsx
   import StudentVerifyPage from './components/paywall/StudentVerifyPage';
   // ...
   <Route path="/students/verify" element={<StudentVerifyPage />} />
   ```
   The confirmation email links to `${APP_URL}/students/verify?token=…`, so this
   path must match `APP_URL` on the server.

2. Drop the card into the upgrade/account area (e.g. near `SubscriptionManager`):
   ```tsx
   import StudentAccessCard from './components/paywall/StudentAccessCard';
   // ...
   <StudentAccessCard />
   ```

## Notes

- Uses the same auth/token conventions as the existing paywall components
  (`import React, { … } from 'react'`, `React.CSSProperties`, `getToken()`),
  so it fits the current design and build. Run the client's `tsc`
  (`tsc -p tsconfig.app.json --noEmit`) as part of your normal build to
  typecheck against the full client dependency set.
- The card never grants anything — entitlement happens server-side only after
  the emailed token is confirmed.
