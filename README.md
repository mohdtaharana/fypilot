# FYPilot — AI Intelligence Layer for FYP Management

Full-stack Final Year Project (FYP) management platform for universities. Students apply online, form groups, submit proposals, get tracked through projects with supervisor meetings, evaluations, weekly updates, chat, notifications, and a built-in AI intelligence layer.

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Backend | **Hono** v4 (TypeScript) on **Cloudflare Pages / Workers** |
| Database | **Cloudflare D1** (SQLite) with native SQL migrations |
| AI | **OpenRouter API → Google Gemma 4 26B** (`google/gemma-4-26b-a4b-it:free`) |
| Frontend | Vanilla **JavaScript SPA** + **Tailwind CSS** (CDN) + Chart.js + FontAwesome |
| Validation | **Zod** |
| Build | **Vite** (`@hono/vite-build/cloudflare-pages` to `dist/_worker.js`) |
| Runtime flags | `nodejs_compat` |

App name in Wrangler: `fypilot` · D1 binding: `DB` · database: `fypilot-production`.

---

## 2. Roles & Auth

### Roles
- **student** — applies, forms groups, submits proposals, works on projects, weekly updates, meetings, chat.
- **supervisor** — reviews proposals/projects, verifies meetings, evaluations, feedback, chat.
- **coordinator** — governs everything: approves accounts/applications/proposals/groups/meetings, manages users, AI recommendation.
- **admin** — treated like coordinator in most guards.
- **hod** — Head of Department: read-only oversight + **audit-log export**.
- **dean** — highest academic oversight + **audit-log export**.

All six roles are enforced by the `users.role` CHECK constraint
(`student, supervisor, coordinator, hod, dean, admin`) — see migration `0015`.

### Auth mechanism  ⚠️ (read this — hybrid)
Auth is currently a **hybrid**: a DB-backed session cookie **plus** legacy identity headers.

**1. Session cookie (new — used for audit export)**
- On login, `POST /api/users/login` creates a row in `user_sessions` and sets an
  **HttpOnly** cookie `fy_session` (12 h TTL, `SameSite=Lax`, `Secure` on HTTPS).
  The token itself is not readable from JS; the role is re-read from D1 on every request.
- `POST /api/users/logout` deletes the row and clears the cookie. The frontend calls it on logout.
- `src/utils/session.ts` owns this: `createSession`, `destroySession`, `getSessionUser(c)`.
- **Why:** `window.open('/api/audit/logs/export')` cannot attach custom headers, so HOD/Dean
  exports 403'd ("Only HOD and Dean can export audit logs."). The cookie is sent automatically
  by the browser on a top-level navigation, so downloads now work with no frontend change.

**2. Legacy headers (still the primary mechanism elsewhere)**
- Identity is also sent as plain HTTP headers: `X-User-Id`, `X-User-Role`.
- Frontend stores the logged-in user object in `localStorage["fypilot_user"]` and attaches
  those headers on every `fetch` via the `api()` helper in `public/static/app.js`.
- **Security consequence:** most role guards read these headers directly and are trivially
  spoofable. Chat/Presence `resolveIdentity()`, `/users/chattable`, and the audit module
  now verify against the DB. Passwords are still stored/compared **in plaintext**
  (D1 `users.password`) — see Known Issues #2.
- Login (`POST /api/users/login`) matches by `email` OR `student_id_num`, blocks
  `pending`/`rejected` accounts, and returns the user record (password stripped).
- **Default passwords** for seeded (password-less) accounts: coordinator → `TahaRana@123`, supervisor → `supervisor123`, student → `student123`. Students created via application approval get the configured default password (coordinators set it during approval, default shown as `student123`).

### Account lifecycle
1. Student uses the **public application page** (`/apply`) — no login needed.
2. Coordinator approves the application → system **auto-provisions**: active student user, group + members, an approved proposal, and an active project.
3. Self-registration endpoint (`POST /api/users/register`) is **disabled** (returns 403 → use `/apply`).

---

## 3. Features / Modules

### 3.1 Student Application Onboarding (`/api/applications`)
- Public 4-step wizard: student info (university email `@stu.smiu.edu.pk`, student ID number), group name + internship **PDF certificate** + up to 3 extra members, 3 supervisor preferences with priority (Normal/Urgent), review → submit.
- Coordinator reviews applications (`Applications` view), can **Approve / Reject / Request Revision** with admin notes. Approval opens a "Set Student Login Password" dialog and auto-creates the user + group + approved proposal + active project.

### 3.2 Groups (`/api/groups`)
- Students form groups up to **4 members** (1 required); leader auto-linked; status `pending` → coordinator/supervisor **approve/reject/change leader**.
- Leader can add/remove members only while `pending`.
- One active group per user enforced by a **partial unique index** (`0009_one_group_per_user`).
- Deleting a group cascades to its proposals/projects.

### 3.3 Proposals (`/api/proposals`)
- Created only by leaders of **approved** groups; statuses `draft → submitted → under_review → approved | rejected | revision_requested`.
- Coordinator/supervisor can change status, assign supervisor; students edit content.
- **Status → `approved` auto-creates an active project** (+ members); leaving `approved` deletes the linked project.

### 3.4 Projects (`/api/projects`)
- Health (`healthy | at_risk | critical`), progress (0–100), supervisor, dates, department.
- Students (members) update progress, add **links**, upload **screenshots** (base64, ≤1 MB, paste supported), submit **weekly updates**.
- Supervisor/coordinator post **feedback** (overall or per-screenshot), **verify meetings** (`verify | reject | request_changes`), submit **evaluations/grading**.
- Verified-meeting count is derived strictly from `meetings.verification_status`.

### 3.5 Chat + Presence (`/api/chats`, `/api/presence`)
- WhatsApp-style 1:1 messenger: text/image/voice/file messages, reply/edit/delete/pin, emoji picker, MediaRecorder voice, typing/recording/online presence, unread/pinned views.
- Role-pairing matrix `canChat()`: coordinator↔supervisor/student, supervisor↔student/coordinator, student↔supervisor/coordinator.
- **These routes are the ONLY ones with DB-verified identity.**
- Frontend polls: chat list 6 s, messages 4 s (incremental `?after=seq`), presence 25 s.

### 3.6 Notifications (`/api/notifications`)
- In-app notification bell with per-view unread badges (dashboard/proposals/projects/groups/chats/people/profile). Polled 8 s.
- `createNotification()` / `notifyRole()` helpers reused across all modules.

### 3.7 AI Intelligence Layer (`/api/ai`) — 8 features
1. **Proposal Quality Analysis** — 5 criteria + structured scoring (`analyze-proposal`)
2. **Project Similarity Analysis** — deterministic TF-IDF + cosine, AI explanation (`analyze-similarity`)
3. **Project Risk Prediction** — deterministic scoring engine + AI recommendation (`analyze-risk`)
4. **Intelligent Supervisor Recommendation** — weighted matching + AI rationale (coordinator only) (`recommend-supervisor`)
5. **AI Project Insights** — positive/warning/critical/recommendation categories (`project-insights`)
6. **Smart Project Summary** (`project-summary`)
7. **Supervisor Feedback Assistant** (supervisor/coordinator only) (`feedback-suggestions`)
8. **Natural Language Project Query** (`project-query`)

Design: **deterministic + AI hybrid** — deterministic algorithms run first; AI explains. All AI responses Zod-validated. Per-user/per-action D1 rate limits (5–20 per 60 s), D1 result caching with input-hash invalidation, full audit log (`ai_audit_log`). Prompts live in `src/modules/ai/prompts/`.

⚠️ `GET /api/ai/debug` is a **debug endpoint** that echoes the OpenRouter key prefix + model and live-fires a completion — do **not** enable in production.

### 3.8 Dashboard (`/api/dashboard`)
- Role-specific dashboards: Coordinator "System Governance Center" (KPIs, pending registrations, proposal/project health charts), Supervisor "Academic Oversight Hub", Student "My FYP Dashboard".
- `people` view (coordinator) — students & groups management.

### 3.9 Users (`/api/users`)
- CRUD + approve/reject + avatar upload (≤500 KB base64) + student profile bundle (`GET /users/:id/student-profile`).
- `POST /api/users` creates an active user of any role directly (used by coordinator "Register Supervisor").

### 3.10 Audit Logs (`/api/audit`) — HOD / Dean
- `audit_logs` records every meaningful state change (actor, role, action, entity, before/after JSON, IP, UA, timestamp).
- `GET /api/audit/logs` — paginated + filterable list (`?entity_type=`, `?action=`, `?user_id=`, `?from=`, `?to=`).
- `GET /api/audit/logs/export?format=csv|json` — full export, **HOD + Dean only**.
- **Authorization (fixed):** resolves the role from `X-User-Role` first, then falls back to the
  `fy_session` cookie whose role is validated against D1. Normalizes `hod`/`dean` correctly.
- This is why the session cookie was added: browser downloads (`window.open`) carry no custom headers.

### 3.11 Defense Scheduling (`/api/defense`) — coordinator
- `defense_deadlines` — per-department/program/shift deadlines & config.
- `defense_slots` — bookable slots (date, time, room, capacity, booked count).
- `defense_submissions` — per-group submission state, file upload, slot booking.
- Routes: `GET/POST /config`, `POST /auto-schedule` (generate slots from config), `GET /`,
  `POST /upload`, `PUT /slots/:id`, `GET /groups/:groupId/download`.

### 3.12 PWA
- Service worker (`public/sw.js`, `fypilot-v1`) stale-while-revalidate caching; `/api/*` always network. Installable (`manifest.webmanifest`).

---

## 4. Database Schema (final state — 26 tables)

Migrations are applied in lexical order. Two `0013`s and two `0014`s exist; the numeric prefix
is only used for ordering, so read the filenames, not the numbers.

```
0001_initial_schema
0002_chat
0002_user_approval
0003_user_password
0004_drop_tasks_milestones
0005_enforce_approved_proposals
0006_groups
0007_users_avatar
0008_project_media
0009_one_group_per_user
0010_notifications
0011_presence
0012_student_applications_and_updates
0013_add_transcript_to_applications
0013_student_application_metadata
0014_defense_workflow
0014_expand_user_roles   (no-op placeholder — see note below)
0015_repair_users_foreign_keys
0016_user_sessions
```

> **Note on `0014_expand_user_roles.sql`** — it is intentionally a no-op (`SELECT 1;`).
> The `users` table has to be rebuilt to widen the `role` CHECK, and a rebuild cannot be done
> in place on D1. That work was folded into `0015`, which already drops every child table
> (children-before-parents) and restores the `users` rows from a snapshot first.

> **Note on `0015_repair_users_foreign_keys.sql`** — D1 always enforces foreign keys
> (`PRAGMA foreign_keys = OFF` is ignored) and `PRAGMA writable_schema` is blocked by `SQLITE_AUTH`,
> so `users` cannot be patched via schema rewriting. `0015` therefore:
> 1. snapshots `users` into `_fkfix_users`,
> 2. drops all child tables (`proposals`, `projects`, `project_members`, `group_members`,
>    `meetings`, `evaluations`, `weekly_updates`, `messages`, `notifications`, `presence`,
>    `project_links`, …),
> 3. drops & recreates `users` with the expanded `role` CHECK,
> 4. restores all rows,
> 5. recreates the child tables with clean FKs + triggers and restores their rows.
>
> `PRAGMA defer_foreign_keys` was removed — it only defers the violation to `COMMIT`, where it
> still fails (D1 rejects a DDL migration that would orphan rows). Children-first ordering is
> what actually works.

> **`tasks` and `milestones` tables DO NOT exist** (migration `0004_drop_tasks_milestones` dropped them). The stale `DELETE FROM tasks` was removed from both `src/utils/cascade.ts` and `src/modules/auth/user.routes.ts`.

| Table | Purpose / key columns |
|---|---|
| `users` | `id, email UNIQUE, name, role(student/supervisor/coordinator/hod/dean/admin), department, expertise(JSON), research_areas(JSON), max_students, avatar_url, avatar(base64), status(active/pending/rejected), password, student_id_num, program, shift, created_at, updated_at` |
| `proposals` | `id, title, abstract, problem_statement, objectives(JSON), methodology, expected_outcomes, technologies(JSON), scope, status(draft/submitted/under_review/approved/rejected/revision_requested), submitted_by→users, supervisor_id→users, group_id→groups` |
| `projects` | `id, title, description, proposal_id→proposals, status(active/completed/on_hold/cancelled), health(healthy/at_risk/critical), progress, supervisor_id→users, department, start_date, end_date` |
| `project_members` | `id, project_id→projects, user_id→users, role(lead/member)` |
| `meetings` | old fields (`status: scheduled/completed/cancelled/missed`) **+** new verification workflow (0012): `student_id, supervisor_id, meeting_date, discussion, work_discussed, action_items, next_meeting_plan, verification_status(pending/verified/rejected/revision_requested), supervisor_feedback, verified_at` |
| `groups` | `id, name, leader_id→users, status(pending/approved/rejected), max_members(4)` |
| `group_members` | `id, group_id→groups, user_id→users, group_status` (synced copy; triggers keep it fresh) + **partial UNIQUE index: one pending/approved group per user** |
| `chats` | `seq PK, id UNIQUE(minUserId|maxUserId), user_a, user_b` |
| `messages` | `seq PK, id UNIQUE, chat_id→chats ON DELETE CASCADE, sender_id→users, type(text/image/voice/file), content, media_data(base64), media_mime, media_duration, reply_to_id→messages, is_pinned, is_edited, read_at, created_at` |
| `notifications` | `seq PK, id UNIQUE, user_id→users, type, title, body, link_view, ref_id, is_read, created_at` |
| `presence` | `user_id PK→users, last_active_at, typing_chat_id, typing_at, recording_chat_id, recording_at` |
| `student_applications` | `id, email UNIQUE, student_id_num UNIQUE, student_name, program(BS/MS), shift(Morning/Evening), department, internship_certificate(base64 PDF), internship_filename, group_name, project_title, group_members(JSON), supervisor_preference_1..3, supervisor_priority(Normal/Urgent), status(submitted/under_review/approved/rejected/revision_requested), admin_notes` |
| `weekly_updates` | `id, project_id, student_id, week_number, work_done, progress_pct, description, planned_work, lifecycle_stage, supervisor_feedback` |
| `evaluations` | `id, project_id, student_id, supervisor_id, grade, score, comments, evaluation_date` |
| `project_links` | `id, project_id, label, url` |
| `project_media` | `id, project_id, uploaded_by→users, caption, data(base64 image)` |
| `project_feedback` | `id, project_id, media_id→project_media(NULL = overall), user_id, message` |
| `feedback` | `id, proposal_id, project_id, from_user_id, to_user_id, content, type, ai_assisted` |
| `ai_analysis_cache` | `id, entity_type, entity_id, analysis_type, result(JSON), model, prompt_version, input_hash, created_at, expires_at` |
| `ai_audit_log` | `id, user_id, user_role, action, entity_type, entity_id, model, prompt_version, input_summary, output_summary, duration_ms, success, error_message, created_at` |
| `ai_rate_limits` | `id, user_id, action, request_count, window_start` |
| `user_sessions` | `id PK, user_id→users ON DELETE CASCADE, created_at, expires_at, last_seen_at, ip, user_agent` + index on `user_id` / `expires_at` (migration `0016`) |
| `audit_logs` | `id PK, actor_id, actor_role, action, entity_type, entity_id, details(JSON), ip_address, user_agent, created_at` |
| `defense_deadlines` | Per-department/program/shift defense config & deadlines |
| `defense_slots` | Bookable defense slots (date, time, room, capacity, booked) |
| `defense_submissions` | Per-group defense submission, uploaded file, booked slot |

> **`tasks` and `milestones` tables DO NOT exist** (migration `0004_drop_tasks_milestones` dropped them — it's a no-op). The codebase no longer uses them except one stale/guarded line in `user.routes.ts` (`DELETE FROM tasks WHERE assigned_to = ?`).

---

## 5. API Reference (all routes)

Mounts (see `src/index.tsx`): `/api/applications`, `/api/ai`, `/api/proposals`, `/api/projects`, `/api/users`, `/api/dashboard`, `/api/groups`, `/api/chats`, `/api/presence`, `/api/notifications`, `/api/defense`, `/api/audit`, plus `GET /api/health` and `GET *` (SPA shell).

Guard legend: **public** = no check · **auth** = header present · **db-auth** = identity verified against DB · **session** = `fy_session` cookie validated against DB · roles = checked from `X-User-Role` header (or session role for audit).

### Applications
| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/api/applications/departments` | public | Program/shift→department matrix |
| POST | `/api/applications` | public | Submit student application (PDF cert, prefs) |
| GET | `/api/applications` | coordinator/admin | List applications |
| GET | `/api/applications/:id` | public | Application detail (incl. PDF) |
| PUT | `/api/applications/:id/status` | coordinator/admin | Approve/reject/request_revision (+ auto-provision on approve) |

### Users
| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/api/users/login` | public | Login (email or student_id + password) — **sets `fy_session` cookie** |
| POST | `/api/users/logout` | public | **Destroy server session + clear cookie** |
| POST | `/api/users/register` | public (disabled) | Always 403 → use `/apply` |
| POST | `/api/users` | **no guard** ⚠️ | Create active user directly |
| GET | `/api/users` | public | List active users (`?role=`) |
| GET | `/api/users/pending` | coordinator | Pending accounts |
| PUT | `/api/users/:id/approve` | coordinator | Approve account |
| PUT | `/api/users/:id/reject` | coordinator | Reject account |
| GET | `/api/users/chattable` | db-auth | Users caller may chat with |
| GET | `/api/users/supervisors/stats` | public | Supervisor workload |
| GET | `/api/users/:id` | public | User detail |
| PUT | `/api/users/:id` | self or coordinator | Update profile (students can't change email) |
| PUT | `/api/users/:id/avatar` | self | Upload base64 avatar (≤500 KB) |
| GET | `/api/users/:id/student-profile` | public | Student bundle: group, project, updates, meetings, evals |
| DELETE | `/api/users/:id` | coordinator | Cascade delete user (not coordinators) |

### Proposals
| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/api/proposals` | public | List (`?status=`) |
| GET | `/api/proposals/:id` | public | Detail |
| POST | `/api/proposals` | student + approved-group leader | Create (status `draft`) |
| PUT | `/api/proposals/:id` | content any role; status/supervisor coordinator+supervisor | Update; auto-create/delete project on approval change |
| POST | `/api/proposals/:id/submit` | **no guard** ⚠️ | Set status → `submitted` |

### Projects
| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/api/projects` | public | List |
| GET | `/api/projects/:id` | public | Rich detail |
| POST | `/api/projects` | **no guard** ⚠️ | Create (requires approved proposal) |
| PUT | `/api/projects/:id` | student=member(progress only); coordinator/supervisor=full | Update |
| POST | `/api/projects/:id/links` | student+member | Add link |
| DELETE | `/api/projects/:id/links/:linkId` | student+member | Remove link |
| POST | `/api/projects/:id/media` | student+member | Upload screenshot (≤1 MB) |
| DELETE | `/api/projects/:id/media/:mediaId` | student+member | Delete screenshot |
| POST | `/api/projects/:id/feedback` | coordinator/supervisor | Post feedback |
| GET | `/api/projects/:id/weekly-updates` | public | List updates |
| POST | `/api/projects/:id/weekly-updates` | student+member | Submit weekly update |
| PUT | `/api/projects/:id/weekly-updates/:updateId/feedback` | supervisor/coordinator | Add feedback to update |
| POST | `/api/projects/:id/meetings` | student | Record meeting (verification pending) |
| GET | `/api/projects/:id/meetings` | public | List meetings |
| PUT | `/api/projects/:id/meetings/:meetingId/verify` | supervisor/coordinator | verify/reject/request_changes |
| POST | `/api/projects/:id/evaluations` | supervisor/coordinator | Submit evaluation |
| GET | `/api/projects/:id/evaluations` | public | List evaluations |

### Dashboard
| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/api/dashboard/stats` | public | Counts |
| GET | `/api/dashboard/people` | coordinator | Students & groups management |
| GET | `/api/dashboard/ai-usage` | **no guard** ⚠️ | AI audit stats + last 20 calls |

### Groups
| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/api/groups` | public | List |
| GET | `/api/groups/available-students` | public | Students not in a group |
| GET | `/api/groups/:id` | public | Detail |
| POST | `/api/groups` | student | Create group (pending, ≤4) |
| POST | `/api/groups/:id/members` | leader (while pending) | Add member |
| DELETE | `/api/groups/:id/members/:memberId` | leader (while pending) | Remove member |
| PUT | `/api/groups/:id/status` | coordinator/supervisor | Approve/reject |
| PUT | `/api/groups/:id/leader` | coordinator/supervisor | Change leader |
| DELETE | `/api/groups/:id` | leader or coordinator | Delete + cascade |

### Chat (all db-auth + participant checks)
| Method | Path | Description |
|---|---|---|
| GET | `/api/chats` | List conversations (+presence, unread, pinned) |
| POST | `/api/chats` | Create/return chat with role-pairing check |
| GET | `/api/chats/:id/messages` | Messages (`?after=seq&limit=&mark_read=1`) |
| POST | `/api/chats/:id/messages` | Send text/image/voice/file (reply_to_id) |
| POST | `/api/chats/:id/read` | Mark peer messages read |
| POST | `/api/chats/:chatId/messages/:messageId/pin` | Pin |
| POST | `/api/chats/:chatId/messages/:messageId/unpin` | Unpin |
| POST | `/api/chats/:chatId/messages/:messageId/edit` | Edit (sender, text only) |
| DELETE | `/api/chats/:chatId/messages/:messageId` | Delete (sender) |
| POST | `/api/presence` | Heartbeat + typing/recording signals |

### Notifications
| Method | Path | Description |
|---|---|---|
| GET | `/api/notifications` | Recent (`?limit=`) |
| GET | `/api/notifications/unread-counts` | Per-view unread totals |
| POST | `/api/notifications/:id/read` | Mark one read |
| POST | `/api/notifications/read-all` | Mark all (optionally by `link_view`) read |

### AI (per-user rate limits; @header identity with demo defaults)
| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/api/ai/analyze-proposal` | rate 5/60s | Proposal quality |
| POST | `/api/ai/analyze-similarity` | rate 5/60s | Similarity |
| POST | `/api/ai/analyze-risk` | rate 10/60s | Risk prediction |
| POST | `/api/ai/recommend-supervisor` | coordinator/admin, rate 10/60s | Supervisor match |
| POST | `/api/ai/project-insights` | rate 10/60s | Insights |
| POST | `/api/ai/project-summary` | rate 10/60s | Summary |
| POST | `/api/ai/feedback-suggestions` | supervisor/coordinator/admin, rate 10/60s | Feedback |
| POST | `/api/ai/project-query` | rate 20/60s | NL query |
| GET | `/api/ai/debug` | **no guard** ⚠️ | Debug: echo key + live test |

### Audit (role via header **or** session cookie — DB-verified)
| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/api/audit/logs` | hod/dean/admin | Paginated audit list (`?entity_type=`, `?action=`, `?user_id=`, `?from=`, `?to=`, `?limit=`) |
| GET | `/api/audit/logs/export` | **hod/dean only** | Export `?format=csv\|json` |

### Defense (coordinator)
| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/api/defense/config` | coordinator | Deadline/schedule config |
| POST | `/api/defense/config` | coordinator | Save config |
| POST | `/api/defense/auto-schedule` | coordinator | Generate slots from config |
| GET | `/api/defense/` | coordinator | List slots & submissions |
| POST | `/api/defense/upload` | coordinator/student | Upload defense submission file |
| PUT | `/api/defense/slots/:id` | coordinator | Update a slot |
| GET | `/api/defense/groups/:groupId/download` | coordinator | Download group submission |

---

## 6. Frontend Screens

Login · Public Apply wizard (`/apply`) · Dashboard (role-specific) · Proposals (+detail w/ exec power + AI tools) · Projects (+detail w/ governance, meetings verification, evaluations, media, AI risk/insights/summary/assistant) · Supervisors directory · Chats · People (coordinator) · Groups (+profile) · Applications (coordinator review) · Profile + notification bell.

The old **"role switcher"** (demo switching between coordinator/supervisor/student) is **removed**; the README's mention of it is outdated — role = the logged-in user's real role.

---

## 7. Frontend / API conventions

- `API_BASE = '/api'` (same-origin relative); all calls via the `api()` helper in `public/static/app.js`.
- Auth headers `X-User-Id` / `X-User-Role` (see §2) **plus** the `fy_session` HttpOnly cookie issued at login.
- Polling: notifications 8 s, chats 6 s, chat messages 4 s, presence 25 s, pending registrations 5 s, applications 20 s.
- SPA entry: `src/index.tsx` (returns the HTML shell; app.js loaded from `/static/app.js`). Catch-all `GET *` serves the SPA.

---

## 8. Running Locally

```bash
npm install

# Database (local D1)
npm run db:migrate:local     # apply all migrations 0001–0016
npm run db:seed              # seed demo data
# (or both: npm run db:reset)

# Build + run worker locally (workerd)
npm run build
npm run preview              # wrangler pages dev dist --d1=fypilot-production --local --port 3000

# OR dev mode with HMR (NOTE: uses Vite dev server; see Known Issues #4)
npm run dev
```

Seed data: 1 coordinator, 5 supervisors, 6 students, 6 proposals, 1 approved project, meetings, 2 groups.

### Environment variables — `.dev.vars` (local) / Pages dashboard (production)

```
OPENROUTER_API_KEY=<your-key>
OPENROUTER_MODEL=google/gemma-4-26b-a4b-it:free
# Email (currently NON-FUNCTIONAL — see Known Issues #1)
EMAILJS_SERVICE_ID=
EMAILJS_PUBLIC_KEY=
EMAILJS_PRIVATE_KEY=
EMAILJS_TEMPLATE_ID=
```

---

## 9. What Works ✅ / What's Broken ⚠️

### Works
- ✅ Whole FYP workflow: public application → coordinator approval (auto-provisions user+group+proposal+project) → groups → proposals → projects → weekly updates → meeting verification → evaluations → feedback.
- ✅ Chat (text/image/voice/file, pin/edit/delete/reply, presence, typing/recording), notifications with per-view unread badges.
- ✅ All 8 AI features (proposal analysis, similarity, risk, supervisor recommendation, insights, summary, feedback assistant, NL query) with rate limiting, caching, audit log, and deterministic fallback.
- ✅ Role-specific dashboards, avatar upload, PWA (installable, offline-cached static assets).
- ✅ Group/team size limits, one-group-per-student enforcement, cascade deletes.
- ✅ `npm run build` → `dist/_worker.js`, runs in `wrangler pages dev` (workerd).
- ✅ **Fixed:** deleting a group/project previously failed with `no such table: tasks` — the stale `DELETE FROM tasks` was removed from `src/utils/cascade.ts` (migration `0004` dropped that table). The same dead statement was later removed from `user.routes.ts`.
- ✅ **Fixed:** HOD/Dean could not download audit logs (`window.open` sends no `X-User-Role` header → 403). Added DB-backed `user_sessions` + HttpOnly `fy_session` cookie, `POST /api/users/logout`, and session-aware role resolution in `audit.routes.ts`. Verified: HOD `200`, Dean `200`, coordinator `403`, supervisor `403`, anonymous `403`, after-logout `403` (both CSV and JSON).
- ✅ **Fixed:** production DB had a corrupted `users_old` table and a `users.role` CHECK that rejected `hod`/`dean`. Repaired via migration `0015` (snapshot → drop children → rebuild `users` → restore). Verified on production: all rows intact, `PRAGMA foreign_key_check` empty, both `trg_gm_group_status_*` triggers restored, no leftover `users_old` / `_fkfix_*` tables, hod/dean rows insertable.
- ✅ **Fixed:** application approval auto-provisioning — approving an application now correctly creates the student, group, approved proposal, and active project in one pass.

### Broken / Not working
- ❌ **#1 — Email notifications DO NOT send (EmailJS).** All routes call email helpers, and EmailJS config exists, but emails do not go out — no one receives approval/notification emails. **In-app notifications work and are the actual channel users rely on.** Attempted fix (SMTP over `cloudflare:sockets` with Gmail) hit `EHLO` rejection: **Gmail rejects the HELO name** used (`fypilot-<host>.local` → `501 5.5.4 HELO/EHLO argument "...invalid`) and was fully reverted. Future fix must send a valid hostname (e.g. the real domain) in EHLO, keep `cloudflare:sockets` external in `vite.config.ts` (`build.rolldownOptions.external`), and re-add SMTP vars to `Env` + `.dev.vars`.
- ❌ **#2 — Auth is only partially hardened.** Passwords are still plaintext, and most role guards
  still trust the `X-User-Id` / `X-User-Role` headers, so any caller can impersonate a user or role.
  What *has* been done: the `fy_session` cookie is HttpOnly with its role re-read from D1 on every
  request (Chat/Presence `resolveIdentity()`, `/users/chattable`, and the whole audit module use it).
  Remaining work: hash passwords (e.g. PBKDF2 via WebCrypto), and migrate the header guards onto the
  session. Migrations are live and `0016_user_sessions` is already applied to production, so extending
  the session usage is a code-only change.
- ❌ **#3 — Unguarded endpoints.** `POST /api/users`, `POST /api/projects`, `POST /api/proposals/:id/submit`, `GET /api/dashboard/ai-usage`, `GET /api/ai/debug` (leaks OpenRouter key prefix + live-fires completions), and most `GET` detail/list routes run without real authorization.
- ❌ **#4 — `npm run dev` cannot resolve `cloudflare:sockets`.** The Vite dev server runs the app in **Node** (`@hono/vite-dev-server`), where `cloudflare:sockets` doesn't exist → `Cannot find module 'cloudflare:sockets'`. Workarounds: use `npm run preview` (real workerd) for email/email needs; or add a dev-only Vite `resolve.alias` (apply: 'serve') mapping `cloudflare:sockets` → a Node `net`/`tls` shim.
- ❌ **#5 — TypeScript errors on `npx tsc`.** Pre-existing: `D1Database` unresolved in `ai.types.ts` / `notification.routes.ts`, dashboard implicit-any, etc. `vite build` does not type-check, so the app builds anyway. (Run via `node node_modules/typescript/bin/tsc --noEmit`. Note: `typescript` is not a local dependency, so `npx tsc` will try to fetch it — run the `node` form or add the devDependency.)
- ❌ **#6 — Misc / cleanup.** `users.avatar` and `users.avatar_url` duplicate each other (only `avatar` used by frontend). `users_old` and other staging tables are fully removed from production. The README "role switcher" and "Register tab" text is outdated.

---

## 10. Deployment (Cloudflare Pages)

```bash
npm run deploy   # = npm run build && wrangler pages deploy dist
```

Production env vars must be added in the Cloudflare Pages dashboard (Settings → Environment variables): `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, and the (currently non-functional) `EMAILJS_*` if email is restored. `.dev.vars` is git-ignored and local-only.

### D1 migrations on production

```bash
npx wrangler d1 migrations list  fypilot-production --remote
npx wrangler d1 migrations apply fypilot-production --remote
```

Always **export a backup before applying**:
`npx wrangler d1 export fypilot-production --remote --output backup.sql`

Current state: `0001`–`0016` applied to `fypilot-production` on 2026-09-27.

---

## 11. D1 gotchas learned the hard way

These cost real debugging time, so they're recorded here rather than rediscovered:

1. **Foreign keys are always on.** `PRAGMA foreign_keys = OFF` is silently ignored. There is no way to
   disable FK enforcement for a migration.
2. **`PRAGMA defer_foreign_keys = ON` does not help for DDL.** It only pushes the violation to `COMMIT`,
   where D1 rejects the whole migration (`FOREIGN KEY constraint failed: SQLITE_CONSTRAINT_FOREIGNKEY [code: 7500]`)
   and rolls it back.
3. **`DROP TABLE users` orphans children.** Implicitly deleting the parent row trips the FK. The only
   workable pattern is **children-first**: drop every referencing table, drop the parent, then recreate
   and restore both sides.
4. **`PRAGMA writable_schema` is blocked** (`not authorized: SQLITE_AUTH [code: 7500]`), so you cannot
   patch a schema in place. `PRAGMA table_info`/`pragma_foreign_key_list` table-valued functions are
   also blocked — use `PRAGMA table_info(<table>)` as a statement instead.
5. **One statement per `--command`.** Compound `UNION ALL` selects with many terms fail with
   `too many terms in compound SELECT: SQLITE_ERROR`. Split verification into separate queries.
6. **A failed multi-migration apply is atomic** — D1 rolls the whole batch back, so re-running is safe
   after fixing the migration.

---

## 12. Project Status

- Initial: **fully functional workflow** (applications → projects) with all 8 AI features.
- Email delivery: **broken** (EmailJS; SMTP attempt reverted).
- Security hardening: **partially done** — session cookie + DB-verified audit/HOD/Dean done; passwords still plaintext and most header guards still client-asserted.
- `tasks` cascade bug: **fixed** (both `cascade.ts` and `user.routes.ts`).
- Production DB integrity: **repaired** via `0015`; `0014`–`0016` applied and verified.
- HOD/Dean audit export: **fixed** via `fy_session` cookie + `POST /api/users/logout`.
- Application approval auto-provisioning: **fixed** (user + group + proposal + project).
- New modules: **audit logs** (`/api/audit`) and **defense scheduling** (`/api/defense`).
- Last touches: HOD/Dean roles, session auth, defense workflow, transcript on applications, `users_old` FK repair, notification badges, auto-sync chat edit/delete/pin, presence indicators, PWA + logo, meeting verifications, password provisioning.