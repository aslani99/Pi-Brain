# Pi Brain — connected Supabase backend

Pi Brain is a React + TypeScript quiz app foundation with a cosmic UI, seven themes, Pi SDK sign-in, and a Supabase backend already provisioned for this project.

## Connected project

- Supabase project: `Pi Brain`
- Project ref: `athxpqwengfnbbyjqbnq`
- Region: Frankfurt (`eu-central-1`)
- API URL: `https://athxpqwengfnbbyjqbnq.supabase.co`
- Browser publishable key and Pi Sandbox flag are prefilled in `.env.local` and `.env.example`.

## Already deployed

### Database
- `profiles`, `questions`, `quiz_sessions`, and `quiz_attempts`
- RLS enabled with explicit deny policies for browser roles.
- Atomic, idempotent server-side answer recording and XP calculation.
- Exact and near-duplicate question screening.
- Eight initial sample questions loaded as `draft` only; none is playable until a human editor checks and approves it.

### Edge Functions
- `pi-auth`
- `start-quiz`
- `submit-answer`
- `leaderboard`
- `generate-questions` (admin secret; saves drafts only)

All five functions are active in Supabase. They validate Pi tokens in the function body, so their built-in Supabase JWT verification is disabled intentionally. The browser sends the Pi access token; the Edge Function verifies it against Pi Platform API.

## Run the frontend

Node.js 20+ is required. From this folder:

```bash
npm install
npm run dev
```

The local `.env.local` is configured for the Pi Brain Supabase project and Pi Sandbox. The publishable key is meant for browser use. Never place a Supabase secret/service-role key in a `VITE_` variable.

## Required account-side setup

In the Supabase Dashboard → Edge Functions → Secrets, add:
- `OPENAI_API_KEY` (only needed for AI question generation)
- `PI_BRAIN_ADMIN_SECRET` (long random admin-only secret)

After hosting the app on an HTTPS domain, add `APP_ALLOWED_ORIGIN` with the exact domain. Supabase automatically injects its project URL and server-side key environment; the functions support the modern `SUPABASE_SECRET_KEYS` dictionary and legacy `SUPABASE_SERVICE_ROLE_KEY`.

The Pi Developer Portal app registration and Pi Browser/Sandbox authorization are separate account steps. The Supabase project named `FileOrganizerCore-Testnet` was paused at the user's request; this does not disable Pi Network Sandbox itself.

See [SETUP_GUIDE_FA.md](SETUP_GUIDE_FA.md) for the Persian walkthrough.

## Verification caveat

The cloud database migrations, security policies, seed rows and Edge Function deployments were confirmed. Supabase reported no security or health lints; its performance advisor currently only reports indexes as unused because the new database has not yet received production traffic. A complete npm install/build and end-to-end Pi Browser sign-in have not yet been run in this environment.
