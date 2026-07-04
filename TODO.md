# TODO - WinGoView Period Sync + Referral/Invite Fixes

- [ ] Inspect WinGoView.tsx period resolution flow and identify the exact “round end” moment.
- [x] Implement Fix 1 in `src/components/WinGoView.tsx`: when a period finishes and bets are being resolved, fetch the authoritative `betting_history` status/win_amount from Supabase for that `user_id`+`period_id`, then update local bet/history state and refresh the user main balance.

- [x] Implement Fix 2 in referral sharing:
  - [x] Add a build-agnostic invite link generator using `window.location.origin` and `/#/register?invite=CODE`.
  - [x] Update the UI action(s) that share/copy invite code to copy the full link (not just code).

- [ ] Implement Fix 3 in `src/components/HomeContent.tsx` if any leftover bypass code exists (ensure login/recharge gating is present and is the only play entry path).

- [ ] Run TypeScript build/lint (or `npm test`/`npm run build`) to confirm no TS errors.

