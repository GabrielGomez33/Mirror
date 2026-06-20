# Server Updates

This directory is the staging area for any changes that must be applied to the
**mirror-server** and **dina-server** code bases as part of work done in the
Mirror front-end repository. Front-end changes live in `client/` and ship with
this repo; back-end changes cannot (they live in separate repos and on separate
production hosts), so they are collected here as **complete, copy‑paste‑ready
files** — never patches.

## Layout

```
server-updates/
├── README.md                       ← you are here
├── mirror-server/                  ← changes / audit notes for mirror-server
│   ├── README.md
│   ├── controllers/
│   │   └── availabilityController.ts   ← NEW (Goal #2) — drop into controllers/
│   ├── routes/
│   │   └── auth.ts                     ← UPDATED (Goal #2) — replaces routes/auth.ts
│   └── optional-hardening/             ← OPTIONAL, non-breaking improvements only
└── dina-server/                    ← changes / audit notes for dina-server
    └── README.md
```

Each server sub-folder mirrors the **exact path layout of that server's repo**,
so a file placed at
`server-updates/mirror-server/optional-hardening/paywall/.payenv.example`
maps 1:1 to `paywall/.payenv.example` in the mirror-server repo. Drop the file
in the same relative location on the production host.

## Architecture ground rule (carried across every goal)

All mirror-server ⇄ dina-server interaction goes through the **dina-server
mirror module at `src/modules/mirror`** — that module is the single entry point
into Dina (separation of concerns). Subscription / paywall **entitlement**
decisions are the exclusive responsibility of **mirror-server's `paywall/`
module**; they are deliberately *not* routed through Dina, because Dina owns
analysis/validation/enrichment, not billing state.

## How to read each goal

For every goal we record:

1. **What the goal required** on the back end.
2. **What already existed** (audited against freshly-cloned `master` of both
   servers).
3. **What — if anything — must change**, as complete files.
4. **Edge-case / test matrix** proving no disruption to the existing ecosystem.

---

## Goal #1 — "Create Group" is a Premium privilege

**Front-end (shipped in this repo):** `client/src/pages/MirrorGroupsPage.tsx`
now renders both "Create Group" CTAs in a greyed-out, lock-badged state for any
user without the `create_group` entitlement, and routes their tap to the
existing upgrade modal instead of the create form.

**Back end:** **No change is required.** mirror-server *already* enforces
`create_group` as a Premium-only action server-side (defense in depth), and
dina-server is not involved in the decision at all. The audit, proof, and full
edge-case test matrix are in [`mirror-server/README.md`](./mirror-server/README.md)
and [`dina-server/README.md`](./dina-server/README.md). One **optional**,
non-breaking config-naming alignment is provided under
`mirror-server/optional-hardening/`.

---

## Goal #2 — Real-time username availability on registration

**Front-end (shipped in this repo):** the registration form now checks username
availability live as the user types (debounced + abortable), showing
"Checking… / ✓ available / ✗ taken" and blocking submit on a confirmed
collision. New service `client/src/services/usernameAvailability.ts`; wired into
`client/src/components/intake/RegistrationStep.tsx`. It degrades gracefully — any
network/rate-limit/undeployed-endpoint outcome is neutral and the authoritative
submit-time `USERNAME_TAKEN` check remains the backstop.

**Back end (REQUIRED — two complete files):**

| File | Action |
|------|--------|
| `mirror-server/controllers/availabilityController.ts` | **NEW** — add to `controllers/` |
| `mirror-server/routes/auth.ts` | **REPLACE** the existing `routes/auth.ts` |

Adds `POST /mirror/api/auth/check-username` (public, IP-rate-limited 30/min):
case-insensitive uniqueness with the *same* rules as `createUserInDB()`, a
reserved-name list, and fail-safe behaviour (never reports a name free if it
couldn't verify). Username-only by design — email existence is **not** exposed
here, so this can't become an email-enumeration oracle. **dina-server is not
involved.** Deployment steps, security rationale, and the edge-case/test matrix
are in [`mirror-server/README.md`](./mirror-server/README.md).

Both back-end files were typechecked (`tsc --noEmit`) against a fresh clone of
`mirror-server@master` — 0 errors.
