# Plan: Invitees data fetch + account_status enforcement + Wingo period fix

## Information Gathered
- Read `backend/supabase/referral_network.sql` successfully.
- It defines `get_network_stats(user_uuid)` but does **not** include `account_status` logic.
- Tooling issue: `search_files` fails due to missing `ripgrep` binary in this environment, so I cannot yet locate existing implementations for:
  - `New Invitees` / `Invitees Overview` views
  - Login component
  - Wingo period number rendering element
  - `backend/game-engine/wingoEngine.ts` period generation loop

## Plan
### A) Supabase / DB changes
1. Add `account_status` column to `public.profiles` with default `'active'`.
2. Add admin logic (SQL) to update `profiles.account_status` to `'suspended'` or `'banned'`.
   - Prefer: Postgres function + appropriate GRANTs.

### B) Referred invitee queries (React + Supabase)
3. Implement queries for:
   - `New Invitees`: profiles where `referred_by = currentUserId`, filtered by `created_at` bucket:
     - Today
     - Yesterday
     - This Month
   - `Invitees Overview` / `Subordinate Data`: for those referred users, query deposit/transaction tables to compute:
     - `Deposit Number`
     - `Deposit Amount`
     - `Total Bet`
     - `Number of Bettors`
4. Make Suspend/Ban buttons call the admin update logic.

### C) Real-time auto-logout
5. Add a React `useEffect` with Supabase Realtime on `profiles` for the logged-in user row.
6. If `account_status` becomes `'suspended'` or `'banned'`, call `supabase.auth.signOut()` and redirect to login.

### D) Login block + exact alerts
7. After successful Supabase auth check, fetch/verify `account_status` for the logged-in user.
8. If suspended: block login and show exact alert text:
   - `your account was temperory suspended, please contact with your head or Teacher`
9. If banned: block login and show exact alert text:
   - `Your accoutn was freeze due to unusual activity, pelase contact with your Teacher`

### E) Wingo UI: uncopyable period number
10. Identify the period number text element.
11. Apply Tailwind/CSS to make it uncopyable:
    - `user-select: none`
    - prevent pointer interactions (`pointer-events-none` if appropriate)
    - optionally disable dragging.

### F) Wingo engine: period skipping bug
12. Edit `backend/game-engine/wingoEngine.ts`:
    - Remove manual counters (e.g. `period++`).
    - Compute period mathematically based on UTC time.
      - For 1-minute mode: period = `YYYYMMDD` + `Math.floor(Date.now()/60000)` as specified.
    - Add a state lock / check in the 2-second interval loop to prevent double-trigger for the same minute.

## Dependent Files to be edited (to be confirmed once tool works)
- `src/components/InviteesOverviewView.tsx`
- `src/components/...` (New Invitees / Subordinate Data)
- `src/...Login*.tsx`
- `src/...Wingo*` (period number rendering)
- `backend/game-engine/wingoEngine.ts`
- SQL: possibly create a new SQL migration file under `backend/supabase/`

## Followup steps
1. Apply SQL changes in Supabase.
2. Deploy updated frontend + backend.
3. Test:
   - Invitee counts change from 0 to real values.
   - Suspend/Ban updates reflect immediately.
   - Suspended/Banned users auto-logout.
   - Login blocks show exact alerts.
   - Wingo period increments by odd numbers (no skips of 2).

<ask_followup_question>
Current environment cannot locate project files because ripgrep is missing, so I cannot identify the exact files/lines to edit for the React + Wingo engine parts yet. Do you want to (1) paste the contents/paths of the relevant React and Wingo files here, or (2) install/enable ripgrep so I can use `search_files`?
</ask_followup_question>

