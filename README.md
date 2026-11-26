# UNSAID. — Your Campus. Your Stories.

Anonymous, text-only campus confession platform built with **React + TypeScript + Tailwind CSS (Pastel Pop PWA)** and **Supabase (PostgreSQL + RLS + Edge Functions)**.

## Architecture Highlights

- **No Login / Registration for Students:** Students enter an official campus code verified server-side by `verify-college`, receiving a short-lived HMAC-SHA256 signed access token bound to their anonymous session ID.
- **Zero Direct Database Writes:** All tables have Row Level Security (RLS) enabled with direct `anon`/`authenticated` privileges revoked. All reads/writes go through Edge Functions with input validation, rate limits, duplicate detection, and moderation.
- **Database Guardrails & Limits:**
  - Confessions: 5–1,000 characters, auto-expiring after **90 days**
  - Comments: 1–500 characters, **max 100 comments per confession** enforced atomically in PostgreSQL (`create_comment_atomic`)
  - College isolation: Composite foreign key `(confession_id, college_id)` guarantees comments & likes belong to the same campus
  - Pagination: 15 confessions per page, 20 comments per page
  - Storage protection: `get_database_health()` monitors DB MB against `300 / 350 / 400 / 450 MB` thresholds with automatic read-only capacity switch

## Project Structure

```text
UNSAID/
├── assests/                         # Original design mockups & source art
├── frontend/                        # React + TypeScript + Vite + Tailwind PWA
│   ├── public/
│   │   ├── assets/mascots/          # Transparent WebP & SVG stickers
│   │   ├── assets/decorations/      # Reusable SVG sparkles/hearts/stars
│   │   └── icons/                   # PWA app icons
│   └── src/
│       ├── components/              # AppShell, ConfessionCard, CommentCard, CategoryPills, CharacterCounter
│       ├── pages/                   # Welcome, Feed, CreateConfession, ConfessionDetails, Report, Saved, Profile, Admin
│       ├── services/                # collegeService, confessionService, commentService, adminService, edgeApi
│       ├── hooks/
│       ├── lib/                     # supabase.ts, session.ts, validation.ts
│       └── types/
└── supabase/
    ├── config.toml
    ├── migrations/                  # PostgreSQL schema, RLS, indexes, atomic RPCs
    ├── seed.sql                     # Sample hashed campus codes for local dev
    └── functions/                   # verify-college, get-feed, get-confession, create-confession, create-comment, toggle-like, report-content, admin-moderation
```

## Quick Start

### 1. Frontend (Local UI Preview)

```bash
cd frontend
npm install
npm run dev
```

In development without `VITE_SUPABASE_URL`, the app runs in **UI Preview Mode** (local browser storage) so you can inspect the Pastel Pop desktop & mobile flows immediately.

### 2. Connect Live Supabase Backend

1. Push database schema & seed sample hashed campus codes:
   ```bash
   supabase db push
   ```
2. Set Edge Function secrets (never expose these in `frontend/`):
   ```bash
   supabase secrets set COLLEGE_TOKEN_SECRET="replace-with-32+-char-random-secret"
   supabase secrets set SESSION_HASH_SALT="replace-with-random-salt"
   supabase secrets set IP_HASH_SALT="replace-with-random-salt"
   supabase secrets set COLLEGE_CODE_SALT="unsaid_college_code_v1"
   supabase secrets set ALLOWED_ORIGINS="http://localhost:5173,https://your-domain.com"
   ```
3. Deploy Edge Functions:
   ```bash
   supabase functions deploy verify-college get-feed get-confession create-confession create-comment toggle-like report-content admin-moderation
   ```
4. Configure `frontend/.env` from `frontend/.env.example`:
   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
   ```
5. Create an admin user in Supabase Auth and insert their `user_id` into `public.admin_users`.
