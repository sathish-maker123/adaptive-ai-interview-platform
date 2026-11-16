# InterviewAI — Adaptive Mock Interview Coach

A React + TypeScript + Vite client with Supabase Auth/Postgres and Supabase Edge Functions for server-side OpenAI question generation and answer evaluation.

## Included
- Responsive candidate UI: sign-in/sign-up, dashboard, interview setup, live Q&A, saved session history and basic progress summary.
- Supabase Auth integration and profile creation trigger.
- PostgreSQL schema, indexes, foreign keys and baseline RLS.
- Edge Functions: `interview-create`, `interview-answer`, `interview-complete`.
- AI question generation and rubric-based structured answer evaluation with server-side OpenAI key.
- `.env.example`, Supabase function config and deployment instructions.

## Important implementation status
This is a runnable full-stack foundation, not a claim that every requirement in the supplied specification is complete. The evaluator assignment/rating UI, MAE/Pearson validation calculations, comprehensive progress comparisons, PDF export, password recovery screens, audit log, robust rate limiting, and automated integration/E2E tests remain to be implemented. The included evaluator page explicitly reports its current limitation. AI evaluation is model-generated and is not ground truth. Do not present it as validated until enough independent human ratings exist.

The current interview flow stores each submitted answer and AI evaluation. Follow-up questions are generated from the latest answer. Session completion stores an average of saved answer scores. The client shows actual session records, not demo scores.

## Requirements
- Node.js 20+
- A Supabase project
- An OpenAI API key

## Local setup
1. Create a Supabase project.
2. In the Supabase SQL editor, run `supabase/migrations/0001_schema.sql`.
3. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Install dependencies and start the client:

   ```bash
   npm install
   npm run dev
   ```

5. Set Edge Function secrets in Supabase (Dashboard → Edge Functions → Secrets):

   ```bash
   supabase secrets set OPENAI_API_KEY=... OPENAI_MODEL=gpt-4.1-mini
   ```

   Also ensure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are available to functions (Supabase provides project variables). Set `APP_ORIGIN` to your deployed frontend origin for production CORS.

6. Deploy functions:

   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy interview-create
   supabase functions deploy interview-answer
   supabase functions deploy interview-complete
   ```

7. Start the frontend again and sign up. Supabase email confirmation settings may require confirming the registration email.

## Security notes before production
- Never put `OPENAI_API_KEY` or Supabase service-role credentials in `VITE_` variables or frontend code.
- Review and test every RLS policy against candidate, evaluator, and admin test accounts before launch. Promote evaluator/admin roles only through a trusted server-side administrative process; never allow self-service role escalation.
- The service-role key bypasses RLS. Edge Functions explicitly authenticate the caller and scope candidate session reads/writes to their user ID. Extend the same checks to every future function.
- Configure restrictive `APP_ORIGIN`, rate limits, request size limits, monitoring and audit logging before public deployment.
- The included SQL uses an evaluator assignment table but does not yet implement an admin assignment workflow.
- Add idempotent client request keys and retry-safe transaction handling before production; the current API accepts an idempotency key but the UI does not yet persist/reuse one on retries.

## Build checks

```bash
npm run typecheck
npm run build
```

## Main structure

```text
src/
  App.tsx
  main.tsx
  styles.css
  lib/{api,supabase,types}.ts
supabase/
  config.toml
  migrations/0001_schema.sql
  functions/
    _shared/ai.ts
    interview-create/index.ts
    interview-answer/index.ts
    interview-complete/index.ts
```

## API function equivalents
- `POST /functions/v1/interview-create`
- `POST /functions/v1/interview-answer`
- `POST /functions/v1/interview-complete`

These are Supabase Edge Function URLs, not separately deployed `/api/...` routes. Use `supabase.functions.invoke()` in the client.
