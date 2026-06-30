# TODO - Registration fix + Invitation enforcement

## Step 1: Identify Failed to fetch source
- [ ] Search codebase for `fetch(`/axios and registration-related network calls.
- [ ] Find the exact component/endpoint producing `Failed to fetch`.

## Step 2: Add backend `/api/register` endpoint
- [x] Implement Express route to handle registration (phone once + IP limiting).

- [x] Validate required invitation code server-side.
- [x] Create user/profile/wallet rows using Supabase server-side client.



## Step 3: Update frontend registration flow
- [x] In `AuthViewReact.tsx`, on register submit call `POST /api/register` instead of direct Supabase.
- [x] Make invitation code required + validate locally (optional, but show better UX).


## Step 4: Invitation code auto-fill from URL
- [x] Parse invitation code from query string (supports `ref`, `referrer`, `invite`, `invitation`, `code`).
- [x] Support hash-based routes: `#/invite/CODE` and `#/ref/CODE`.
- [x] Auto-set `inviteCode` when register screen opens.



## Step 5: Enforce phone uniqueness
- [ ] Add Supabase DB unique constraint recommendation (`users.phone_number`).
- [ ] Backend must return a clear error when phone already exists.

## Step 6: Enforce IP + phone abuse protection
- [ ] Backend must rate-limit by IP and store IP/phone attempts in a table (or in-memory + persistence if table exists).
- [ ] Reject registration attempts matching same (IP, phone) pattern and/or too many attempts per IP.

## Step 7: Test
- [ ] Registration without invite shows validation error.
- [ ] Registration with invalid invite rejected.
- [ ] Invitation URL pre-fills invite code.
- [ ] Same phone cannot re-register.

- [ ] Same IP abuse blocked.


