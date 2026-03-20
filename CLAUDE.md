# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (Turbopack, localhost:3000)
npm run build    # Production build
npm run start    # Run production build
```

No test runner or lint script is configured.

## Architecture Overview

This is a **Next.js 16 App Router** full-stack app for parsing and visualizing power-grid "E-file" data. Uses **SQLite + Drizzle ORM** for persistence, **JWT cookies** for auth.

### Route Structure

```
app/
  page.tsx                          → redirects to /cases
  (auth)/login, register            → email/password auth (client components, calls /api/auth/*)
  (app)/cases/page.tsx              → Server component: fetches profile, renders CaseManagementClient
  (app)/cases/[caseId]/page.tsx     → Server component: fetches case + role, renders WorkspaceClient
  admin/                            → Admin panel (stats, user/case management)
  api/
    auth/login, register, logout/   → JWT auth endpoints
    parse/                          → POST: parses E-file text → { sectionTag, meta, fields, labels, rows }
    cases/                          → GET/POST cases
    cases/[caseId]/                 → GET/PATCH/DELETE single case
    cases/[caseId]/histories/       → GET (no rows)/POST/DELETE histories
    cases/[caseId]/histories/[id]/  → GET (with rows)/PATCH/DELETE single history
    join/                           → POST: left-join two histories server-side
    export/, import/                → Backup/restore
```

### Auth & Session

- **`lib/auth/session.ts`**: JWT using `jose`. `getUser()` reads session cookie and verifies JWT. `setSessionCookie()` / `clearSessionCookie()` manage the `session` cookie (httpOnly, 30d, sameSite=lax).
- **`lib/auth/password.ts`**: `bcryptjs` hash/verify.
- **`proxy.ts`** (Next.js 16 equivalent of `middleware.ts`): Protects routes at the edge using `jwtVerify` from `jose`. Admin routes check `isAdmin` from JWT payload. No DB access in proxy.
- **JWT payload**: `{ id, email, username, isAdmin }`. If admin rights change in DB, user must re-login.

### Database

- **`lib/db/index.ts`**: `better-sqlite3` singleton (global `__db` pattern for hot-reload safety). Creates tables via `sqlite.exec(CREATE TABLE IF NOT EXISTS ...)` on first run. WAL mode + foreign keys enabled. DB file: `./data/app.db` (gitignored).
- **`lib/db/schema.ts`**: Drizzle ORM schema. JSON fields use `text('col', { mode: 'json' }).$type<T>()` for auto-parse/stringify.
- **`lib/db/helpers.ts`**: `historyToApi(row, includeRows?)` converts Drizzle camelCase to API snake_case response format.

All API routes use `getUser()` from `lib/auth/session` for identity. No Supabase, no RLS.

### State Management: AppContext

`context/AppContext.tsx` is the single source of truth for all client state. No Realtime subscriptions (owner-only model makes them unnecessary). Instantiated in two places:
- `CaseManagementClient` — case list, no `initialCase`
- `WorkspaceClient` — workspace, passes `initialCase` to skip the case fetch

Key behaviors:
- `loadHistories` fetches **without `rows`** (perf optimization). `rows` is an empty array until `loadHistoryRows` is called.
- `loadHistoryRows` is triggered lazily when a history item is selected or VizModal opens.
- `addHistory` deduplicates by `id`.
- `showToast` is exposed from context; `ToastContainer` renders inside `AppProvider`'s return.

### Styling Convention

**All UI components use pure inline styles** — do not use Tailwind utility classes in component JSX. The only safe place for Tailwind is admin panel layout (`app/admin/layout.tsx`) and global base styles.

For scrollable nested flex containers, use the `position: relative` outer + `position: absolute; inset: 0` inner pattern rather than relying on `flex: 1; minHeight: 0; overflowY: auto` chains.

Any component using `createPortal` must guard with `useState(false)` + `useEffect(() => setMounted(true), [])` before rendering to avoid SSR hydration mismatches.

### Data Model

**`histories` table** is the core entity (stored as TEXT JSON in SQLite):
- `fields: string[]` — internal field names (ASCII-safe)
- `labels: string[]` — display names (may contain Chinese)
- `rows: Row[]` — array of `{ [field]: string }` — values stored as strings universally
- `col_config: Record<string,boolean>` — visibility per column
- `viz_configs: VizConfig[]` — chart configs
- `sort_order: number` — display ordering (descending = newest first)

**`case_members` table** stores role (`owner | editor | viewer`) per user per case. `GET /api/cases` only returns cases where `owner_id = user.id` (simplified, no shared cases in list).

### E-file Parser (`lib/parser.ts`)

Parses proprietary text format:
- `<! Key=Value !>` → meta block
- `<TagName>` → sectionTag
- `@ Field1 Field2 ...` → field definitions
- `/@ Label1 Label2 ...` → optional display labels
- Data rows: space-separated values matching field count

### Key Cross-Cutting Concerns

- **DB field naming**: DB/Drizzle uses camelCase in ORM; API responses use snake_case (via `historyToApi()`); frontend's `normalizeHistory()` converts snake_case → camelCase.
- **Page size default**: 22 rows (set in `normalizeHistory` and in the POST histories route).
- **Chart rendering**: VizModal uses `rowCount = sourceRecord?.rows.length ?? 0` as a `useEffect` dependency to re-trigger chart generation after async row loading completes.
- **First admin**: Use `sqlite3 data/app.db "UPDATE profiles SET is_admin=1 WHERE email='your@email.com'"` to grant admin access.
