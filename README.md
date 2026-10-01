# FYPilot — AI Intelligence Layer & University FYP Management Platform

FYPilot is an enterprise-grade, full-stack Final Year Project (FYP) management and evaluation platform built for universities. It digitizes the entire academic project lifecycle—from public student admissions and group formations to proposal reviews, defense scheduling, supervisor supervision meetings, weekly logs, rubrics-based external evaluation with QR codes, departmental audit trails, and an AI intelligence layer.

Live Production URL: [https://fypilot.pages.dev](https://fypilot.pages.dev)  
Repository: [https://github.com/mohdtaharana/fypilot](https://github.com/mohdtaharana/fypilot)

---

## 1. Tech Stack & Architecture

| Layer | Technology |
|---|---|
| **Backend Runtime** | **Hono v4** (TypeScript) running on **Cloudflare Pages / Workers (workerd)** |
| **Database** | **Cloudflare D1** (Serverless Distributed SQLite) with native SQL migrations (0001–0024) |
| **AI Intelligence Layer** | **OpenRouter API** powering **Google Gemma 4 26B** (`google/gemma-4-26b-a4b-it:free`) with hybrid deterministic algorithms |
| **Frontend UI** | Modern Vanilla **JavaScript SPA**, **Tailwind CSS**, **Chart.js**, **FontAwesome** |
| **QR Code Generation** | **QRCode.js** client-side IIFE bundle (`public/static/vendor/qrcode.min.js`) |
| **Validation & Schemas** | **Zod** schema validation for all incoming payloads and AI structured outputs |
| **PWA & Offline Shell** | Service Worker (`public/sw.js`) with stale-while-revalidate caching and app manifest |
| **Build & Bundler** | **Vite** (`@hono/vite-build/cloudflare-pages` compiling to `dist/_worker.js`) |

![FYPilot complete lifecycle architecture](public/images/FYPilot_%20Complete%20FYP%20Lifecycle%20Architecture.png)

- **Wrangler Project Name:** `fypilot`
- **D1 Database Binding:** `DB` (`fypilot-production`)
- **Compatibility Flags:** `nodejs_compat`

---

## 2. Roles & Access Control

The platform enforces strict role-based access across six distinct institutional personas, validated via D1 constraints (`users.role`):

1. **Student**
   - Applies via the public onboarding wizard with university credentials and internship proof.
   - Creates and manages project groups (up to 4 members).
   - Drafts and submits FYP proposals.
   - Submits weekly progress updates, uploads screenshots/media, and logs supervisor meetings.
   - Communicates with assigned supervisors and coordinators via 1:1 chat.
   - Accesses defense booking and reviews finalized evaluation scores.

2. **Supervisor**
   - Reviews and provides feedback on student proposals and assigned projects.
   - Formally verifies, requests changes on, or rejects student meeting logs.
   - Reviews weekly updates and provides structured guidance.
   - Assesses project health, risks, and milestones.
   - Communicates with students and coordinators via 1:1 chat.

3. **Coordinator**
   - Central academic governing role across departments.
   - Reviews, approves, rejects, or requests revisions on student applications.
   - One-click auto-provisions active student accounts, groups, proposals, and active projects upon application approval.
   - Configures defense schedules, deadlines, rooms, and auto-generates presentation slots.
   - Generates and issues secured QR-code evaluation tokens for external examiners.
   - Uses AI supervisor recommendations to balance faculty workload.

4. **Admin**
   - Holds elevated system maintenance and governance rights equivalent to Coordinator across all endpoints.

5. **Head of Department (HOD)**
   - High-level academic oversight across all departmental projects, groups, and faculty workloads.
   - Accesses complete audit logs with CSV/JSON export capabilities for compliance and accreditation.

6. **Dean**
   - Highest institutional oversight.
   - System-wide visibility across all departments, defense records, evaluations, and compliance audit exports.

7. **External Examiner (Token-Based)**
   - External evaluators access unguessable, cryptographically secure 128-bit evaluation URLs via QR code or direct link (`/evaluate/:token`).
   - Fill out university-standard rubrics without requiring an institutional account.

---

## 3. Core Modules & Features

```
                                  FYPilot Architecture
                                  
  [ Public Student Application ] ──► [ Coordinator Review & Auto-Provision ]
                                                    │
                                                    ▼
   [ External Examiner (QR Code) ] ◄── [ Project Work & Supervisor Meetings ] ──► [ AI Intelligence Layer ]
                 │                                  │                                    │
                 ▼                                  ▼                                    ▼
       [ Rubric Evaluations ]             [ Defense Scheduling ]               [ Quality / Risk / Match ]
                 │                                  │                                    │
                 └──────────────────┬───────────────┴────────────────────────────────────┘
                                    ▼
                     [ D1 Audit Trail & Governance (HOD/Dean) ]
```

### 3.1 Student Application & Auto-Provisioning (`/api/applications`)
- Multi-step onboarding application form accessible without prior authentication.
- Captures student registration details (`@stu.smiu.edu.pk` email, student ID), program (BS/MS), shift (Morning/Evening), department, internship certificate (PDF/base64), group members, and ranked supervisor preferences.
- Coordinators review applications in a dedicated governance dashboard with one-click actions:
  - **Approve:** Automatically provisions an active student account, links group members, sets up an approved proposal, initializes an active project, and prompts the default password.
  - **Request Revision:** Sends detailed notes to students for amendments.
  - **Reject:** Marks the submission with administrative feedback.

### 3.2 Groups & Collaboration (`/api/groups`)
- Students can form collaborative groups of up to 4 members.
- Database-level partial unique index ensures each student can only belong to one active or pending group at any given time.
- Group leaders can manage membership before final approval.
- Complete cascade delete support for administrative reorganization.

### 3.3 Proposals & Defense Scheduling (`/api/proposals`, `/api/defense`)
- Leaders of approved groups submit proposals with problem statements, methodologies, technology stacks, and target milestones.
- Coordinators can configure department-wise defense deadlines, presentation rooms, slot capacities, and auto-schedule defense sessions.
- Students can upload final defense deliverables directly to their booked slot.

### 3.4 Projects & Supervision Tracking (`/api/projects`)
- Comprehensive project tracking dashboard displaying real-time health (`healthy`, `at_risk`, `critical`), completion percentage, and active milestones.
- Weekly progress logging: students submit logs which supervisors review and comment on.
- Formal meeting logs: students record supervision meetings with action items; supervisors formally verify, reject, or request revisions.
- Project media gallery: supports screenshot uploads (base64) with per-image feedback threads.

### 3.5 FYP Evaluation & Rubric System (`/api/evaluations`)
- **Single Source of Truth Rubrics:** Standardized university scoring rubrics across 6 primary dimensions (21 individual criteria columns):
  1. *Project Content & Objectives* (Problem formulation, literature review, methodology, results)
  2. *Technical Proficiency* (Coding skills, tooling, system complexity)
  3. *Presentation Skills* (Clarity, oral defense, Q&A handling)
  4. *Report Quality* (Structure, conciseness, citation formatting)
  5. *Teamwork & Contribution* (Individual student contribution)
  6. *Overall Impact* (Real-world applicability, scope)
- **Unguessable QR Code Slips:** Each group is issued a cryptographically secure 128-bit hex token (`/evaluate/:token`). Coordinators and supervisors can display and print QR codes directly from the browser.
- **Examiner Scoring Portal:** External examiners scan the QR code to access a mobile-optimized evaluation portal. The server validates and computes total scores and letter grades independently.
- **Automated Results Dispatch:** Upon evaluation submission, structured summary emails with complete rubric breakdowns are dispatched to students, group leaders, supervisors, and coordinators.
- **Audit Integration:** Every evaluation submission is logged into the departmental audit trail.

### 3.6 1-to-1 Real-Time Chat & Presence (`/api/chats`, `/api/presence`)
- Direct messaging between students, supervisors, and coordinators.
- Supports rich media (text, images, voice notes via MediaRecorder API, document attachments).
- Message operations: pinned messages, message editing, soft deletions, and replies.
- Presence tracking: heartbeat updates, typing indicators, recording state, and unread counts.

### 3.7 In-App Notifications (`/api/notifications`)
- Real-time notification center with unread counters and badge indicators across dashboard tabs.
- Automated triggers on proposal updates, application reviews, meeting verifications, feedback, defense schedules, and evaluation postings.

### 3.8 AI Intelligence Layer (`/api/ai`)
A hybrid architecture combining deterministic statistical scoring with large language model analysis:
1. **Proposal Quality Analysis:** Evaluates feasibility, methodology, and problem scope against structured rubrics.
2. **Project Similarity & Duplication Check:** Deterministic TF-IDF cosine similarity vector comparisons paired with AI semantic overlap analysis.
3. **Project Risk Prediction:** Multi-factor scoring engine assessing deadline delays, meeting frequency, and weekly updates.
4. **Intelligent Supervisor Recommendation:** Matches project domains and keywords with faculty research areas and current supervision quotas.
5. **Smart Project Insights:** Automated extraction of highlights, risk areas, and actionable recommendations.
6. **Executive Project Summary:** High-level overview generation for committee reviews.
7. **Supervisor Feedback Assistant:** Generates constructive, actionable feedback prompts for faculty.
8. **Natural Language Query Engine:** Allows coordinators to query project statuses and analytics using conversational prompts.

- Built-in caching (`ai_analysis_cache`), rate limiting per user/action, and complete audit logging (`ai_audit_log`).

### 3.9 Audit Trail & Accreditation Governance (`/api/audit`)
- Immutable audit log capturing all system activities (actor ID, role, action, entity type, JSON state diff, client IP, user agent, timestamp).
- Dedicated oversight view for HOD and Dean.
- Secure, high-speed CSV and JSON data export for accreditation documentation.

---

## 4. Database Architecture & Migrations

The database is built on **Cloudflare D1** (distributed SQLite) utilizing strict foreign key cascades and relational integrity across 26 core tables.

### Applied Migration History

```
0001_initial_schema                     - Core users, proposals, projects, meetings, tasks
0002_chat                               - 1:1 chat rooms and messages schema
0002_user_approval                      - User registration approval states
0003_user_password                      - Password support for direct accounts
0004_drop_tasks_milestones              - Schema cleanup of legacy task models
0005_enforce_approved_proposals         - Relational trigger enforcing proposal-project linkage
0006_groups                             - Student groups and member mapping
0007_users_avatar                       - Profile avatar support
0008_project_media                      - Project screenshots and media attachments
0009_one_group_per_user                 - Partial unique index: one active group per student
0010_notifications                      - Notification delivery and badge tracking
0011_presence                           - User online presence and typing heartbeat
0012_student_applications_and_updates   - Public onboarding application and weekly logs
0013_add_transcript_to_applications     - Academic transcript fields in student applications
0013_student_application_metadata       - Application preferences and priority metadata
0014_defense_workflow                   - Defense schedules, booking slots, and submissions
0014_expand_user_roles                  - Role expansion preparatory migration
0015_repair_users_foreign_keys          - Schema rebuild for HOD/Dean role check constraints
0016_user_sessions                      - Server-backed sessions and authentication cookies
0017_unique_student_id_num              - Unique student ID constraint enforcement
0018_fyp_evaluations                    - Comprehensive FYP evaluation table and group tokens
0018_member_document_fields            - Student document storage for internship/transcript uploads
0019_evaluation_form_metadata           - Examiner credentials, degree, and presentation date
0020_evaluation_raw_score               - Raw scoring and weighted total preservation
0021_rescale_legacy_evaluation_totals   - Scoring formula normalization
0022_evaluation_plain_totals            - Plain total mark calculations
0023_fyp_evaluations_token_not_unique   - Multi-examiner evaluation support per group token
0024_application_transcript_text       - Transcript text persistence for transcript verification
```

### Key Database Tables

| Table | Purpose | Key Attributes |
|---|---|---|
| `users` | User accounts across all roles | `id`, `email`, `name`, `role`, `department`, `student_id_num`, `avatar`, `status` |
| `groups` | Student groups | `id`, `name`, `leader_id`, `status`, `evaluation_token` |
| `group_members` | Group membership links | `group_id`, `user_id`, `group_status` |
| `proposals` | FYP proposals | `id`, `title`, `abstract`, `status`, `group_id`, `supervisor_id` |
| `projects` | Active FYP projects | `id`, `title`, `proposal_id`, `status`, `health`, `progress`, `supervisor_id` |
| `meetings` | Supervisor supervision logs | `project_id`, `meeting_date`, `discussion`, `action_items`, `verification_status` |
| `weekly_updates` | Student weekly progress logs | `project_id`, `student_id`, `week_number`, `work_done`, `progress_pct` |
| `fyp_evaluations` | Standardized evaluation records | `id`, `token`, `group_id`, `total_score`, `grade`, `examiner_name`, rubric columns |
| `defense_slots` | Defense presentation slots | `id`, `date`, `time`, `room`, `capacity`, `booked_count` |
| `defense_submissions` | Defense submission uploads | `id`, `group_id`, `slot_id`, `file_url`, `status` |
| `chats` & `messages` | Internal messaging | `id`, `sender_id`, `content`, `media_data`, `reply_to_id`, `is_pinned` |
| `notifications` | In-app alerts | `id`, `user_id`, `title`, `body`, `link_view`, `is_read` |
| `user_sessions` | Server-managed session store | `id`, `user_id`, `expires_at`, `ip`, `user_agent` |
| `audit_logs` | Institutional audit trail | `id`, `actor_id`, `actor_role`, `action`, `entity_type`, `details`, `ip_address` |
| `ai_analysis_cache` | AI response cache | `id`, `entity_type`, `analysis_type`, `result`, `input_hash`, `expires_at` |

---

## 5. API Reference

All backend API routes are mounted under `/api/*` in `src/index.tsx`:

### 5.1 Student Applications (`/api/applications`)
- `GET /api/applications/departments` — List available departments, programs, and shifts.
- `POST /api/applications` — Submit a new student application with attached internship certificate.
- `GET /api/applications` — List submitted applications (Coordinator/Admin).
- `GET /api/applications/:id` — Retrieve detailed application data including attached credentials.
- `PUT /api/applications/:id/status` — Approve, reject, or request revisions on an application.

### 5.2 Evaluations & Rubrics (`/api/evaluations`)
- `GET /api/evaluations/criteria` — Public definition of scoring rubrics and maximum point distributions.
- `GET /api/evaluations/form/:token` — Fetch group details, members, and rubric form for a given evaluation token.
- `POST /api/evaluations/submit` — Submit completed examiner evaluation with server-side validation and grade assignment.
- `GET /api/evaluations/link/:groupId` — Issue or retrieve the secure evaluation URL and token for a group.
- `GET /api/evaluations/groups/:groupId` — Retrieve all completed evaluations for a group.
- `GET /api/evaluations/:id` — View detailed evaluation breakdown.
- `GET /api/evaluations` — List all evaluations across the institution (Coordinator/Staff).

### 5.3 Groups (`/api/groups`)
- `GET /api/groups` — List student groups.
- `GET /api/groups/available-students` — List students not currently assigned to a group.
- `GET /api/groups/:id` — Get detailed group profile and members.
- `POST /api/groups` — Create a new student group.
- `POST /api/groups/:id/members` — Add member to group (Group Leader).
- `DELETE /api/groups/:id/members/:memberId` — Remove member from group.
- `PUT /api/groups/:id/status` — Approve or reject group formation (Coordinator/Supervisor).
- `PUT /api/groups/:id/leader` — Change group leader.
- `DELETE /api/groups/:id` — Delete group and cascade references.

### 5.4 Proposals (`/api/proposals`)
- `GET /api/proposals` — List proposals with filtering by status.
- `GET /api/proposals/:id` — Retrieve proposal details.
- `POST /api/proposals` — Create a new proposal draft (Group Leader).
- `PUT /api/proposals/:id` — Update proposal contents, assign supervisor, or change review status.
- `POST /api/proposals/:id/submit` — Formally submit proposal for review.

### 5.5 Projects & Supervision (`/api/projects`)
- `GET /api/projects` — List active projects with progress and health statuses.
- `GET /api/projects/:id` — Detailed project dashboard.
- `POST /api/projects` — Initialize an active project.
- `PUT /api/projects/:id` — Update project metadata, health, or progress percentage.
- `POST /api/projects/:id/weekly-updates` — Submit weekly progress updates.
- `GET /api/projects/:id/weekly-updates` — List weekly update records.
- `PUT /api/projects/:id/weekly-updates/:updateId/feedback` — Supervisor feedback on progress updates.
- `POST /api/projects/:id/meetings` — Record supervisor meeting.
- `GET /api/projects/:id/meetings` — List logged meetings.
- `PUT /api/projects/:id/meetings/:meetingId/verify` — Verify, reject, or request changes on meeting logs.
- `POST /api/projects/:id/media` — Upload screenshot / media artifact.
- `DELETE /api/projects/:id/media/:mediaId` — Delete uploaded media artifact.
- `POST /api/projects/:id/feedback` — Submit general or screenshot-specific feedback.

### 5.6 Defense Scheduling (`/api/defense`)
- `GET /api/defense/config` — Retrieve defense scheduling configuration.
- `POST /api/defense/config` — Save defense dates and room setup.
- `POST /api/defense/auto-schedule` — Automatically generate defense presentation slots.
- `GET /api/defense` — List scheduled slots and group bookings.
- `POST /api/defense/upload` — Upload defense presentation files.
- `PUT /api/defense/slots/:id` — Update defense slot parameters.
- `GET /api/defense/groups/:groupId/download` — Download student defense deliverables.

### 5.7 AI Intelligence Layer (`/api/ai`)
- `POST /api/ai/analyze-proposal` — Deep proposal quality and feasibility analysis.
- `POST /api/ai/analyze-similarity` — Project duplication detection (TF-IDF + AI semantic comparison).
- `POST /api/ai/analyze-risk` — Multi-metric risk prediction and mitigation suggestions.
- `POST /api/ai/recommend-supervisor` — Intelligent faculty workload and specialization matching.
- `POST /api/ai/project-insights` — Automated project health insights and warnings.
- `POST /api/ai/project-summary` — Concise executive summary generation.
- `POST /api/ai/feedback-suggestions` — Contextual feedback prompts for supervisors.
- `POST /api/ai/project-query` — Natural language queries on project repositories.

### 5.8 1-to-1 Chat & Presence (`/api/chats`, `/api/presence`)
- `GET /api/chats` — List user conversations with presence and unread counts.
- `POST /api/chats` — Open or retrieve a direct conversation channel.
- `GET /api/chats/:id/messages` — Fetch message history with incremental pagination.
- `POST /api/chats/:id/messages` — Send message (text, media, audio, file).
- `POST /api/chats/:chatId/messages/:messageId/pin` — Pin important message.
- `POST /api/chats/:chatId/messages/:messageId/unpin` — Unpin message.
- `POST /api/chats/:chatId/messages/:messageId/edit` — Edit sent text message.
- `DELETE /api/chats/:chatId/messages/:messageId` — Delete sent message.
- `POST /api/presence` — Send user heartbeat, typing status, or recording indicator.

### 5.9 Audit & Oversight (`/api/audit`)
- `GET /api/audit/logs` — Filterable and paginated audit records.
- `GET /api/audit/logs/export` — Streamed audit export in CSV or JSON format (HOD & Dean).

### 5.10 Users & Authentication (`/api/users`)
- `POST /api/users/login` — Authenticate via email or student ID; issues `fy_session` cookie.
- `POST /api/users/logout` — Terminate session and clear cookie.
- `GET /api/users` — List active university users.
- `GET /api/users/:id` — View user profile details.
- `PUT /api/users/:id` — Update profile information.
- `PUT /api/users/:id/avatar` — Upload base64 profile picture.
- `GET /api/users/:id/student-profile` — Aggregated student dossier (group, project, updates, evaluations).

---

## 6. Local Development & Setup

### Prerequisites
- Node.js (v18 or higher)
- npm or pnpm
- Cloudflare Wrangler CLI (`npm install -g wrangler`)

### Step-by-Step Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/mohdtaharana/fypilot.git
   cd fypilot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Initialize local D1 database:**
   ```bash
   # Apply all migrations (0001 through 0023)
   npm run db:migrate:local

   # Seed initial demo users and reference data
   npm run db:seed
   ```

4. **Configure local environment variables:**
   Create a `.dev.vars` file in the project root:
   ```env
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   OPENROUTER_MODEL=google/gemma-4-26b-a4b-it:free
   SMTP2GO_API_KEY=your_smtp2go_key_here
   EMAIL_FROM=noreply@fypilot.pages.dev
   ```

5. **Build and run locally:**
   ```bash
   # Start Vite dev mode for local app development
   npm run dev

   # Build worker bundle
   npm run build

   # Run local Workerd preview on port 3000
   npm run preview
   ```

6. **Access the application:**
   Open the Vite app in your browser, or preview via [http://localhost:3000](http://localhost:3000) after running `npm run preview`.

> Note: when using older local D1 databases, the app now auto-adds missing application columns such as `transcript_text` before inserts to keep the system compatible with earlier schema states.

---

## 7. Cloudflare Pages Deployment

FYPilot is deployed globally on Cloudflare Pages and edge workers.

### Production Build & Direct Deployment

```bash
# Build the production worker and deploy static assets + worker to Cloudflare Pages
npm run deploy
```

*(This compiles the Vite bundle to `dist/_worker.js` and runs `wrangler pages deploy dist`)*

### Applying D1 Database Migrations in Production

```bash
# Verify current migration status on remote database
npx wrangler d1 migrations list fypilot-production --remote

# Apply any pending migrations to production
npx wrangler d1 migrations apply fypilot-production --remote
```

> **Production Recommendation:** Export a database backup before applying schema changes:
> ```bash
> npx wrangler d1 export fypilot-production --remote --output backup_$(date +%F).sql
> ```

### Production Environment Variables

Add the following environment variables in the Cloudflare Dashboard under **Workers & Pages > fypilot > Settings > Environment Variables**:

- `OPENROUTER_API_KEY`: API key for OpenRouter AI inference.
- `OPENROUTER_MODEL`: Selected model identifier (e.g. `google/gemma-4-26b-a4b-it:free`).
- `SMTP2GO_API_KEY`: API key for automated transactional notifications.
- `EMAIL_FROM`: Sender address for institutional notifications.

---

## 8. License

Distributed under the MIT License. See `LICENSE` for more information.