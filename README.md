# Synapse — AI Intelligence Layer for FYP Management

## Project Overview
- **Name**: Synapse
- **Goal**: An AI-powered Final Year Project (FYP) management platform for universities
- **Core Innovation**: Real AI intelligence layer using Google Gemma 4 via OpenRouter, deeply integrated with application data
- **Tech Stack**: Hono + TypeScript + Cloudflare Pages + D1 Database + Tailwind CSS

## Live Demo
- **URL**: Deployed via Cloudflare Pages dev server
- **Demo Users**: Switch between Coordinator, Supervisor, and Student views using the role switcher

## AI Features (All 8 Implemented)

### Priority 1 — Core
1. **Proposal Quality Analysis** — AI evaluates proposals on 5 criteria with structured scoring
2. **Project Similarity Analysis** — Deterministic TF-IDF + cosine similarity with AI explanation
3. **Project Risk Prediction** — Deterministic risk scoring engine + AI explanation/recommendations

### Priority 2
4. **Intelligent Supervisor Recommendation** — Weighted scoring model + AI reasoning
5. **AI Project Insights** — Data-driven insights categorized as positive/warning/critical/recommendation
6. **Smart Project Summary** — Executive summary generated from real project data

### Priority 3
7. **Supervisor Feedback Assistant** — AI-suggested review points for proposal/project review
8. **Natural Language Project Query** — Ask questions about projects in natural language

## Architecture

```
Frontend (Vanilla JS + Tailwind)
    ↓
Hono API (Backend)
    ↓
AI Service Layer (centralized)
    ↓
OpenRouter API → Google Gemma 4 26B
    ↓
Zod Schema Validation
    ↓
D1 Database (SQLite)
    ↓
Frontend UI
```

## Key Technical Decisions

1. **Deterministic + AI Hybrid**: Risk scoring, similarity calculation, and supervisor matching use deterministic algorithms first, then AI explains the results
2. **Schema Validation**: All AI responses validated with Zod before use
3. **Graceful Fallback**: If AI fails, deterministic results are still shown
4. **Rate Limiting**: Per-user, per-action rate limits stored in D1
5. **Caching**: AI results cached with input hash for invalidation
6. **Audit Trail**: All AI operations logged with timestamps, model info, and results

## API Endpoints

### Data Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/proposals` | List proposals |
| GET | `/api/proposals/:id` | Get proposal detail |
| POST | `/api/proposals` | Create proposal |
| PUT | `/api/proposals/:id` | Update proposal |
| GET | `/api/projects` | List projects |
| GET | `/api/projects/:id` | Get project with tasks/milestones |
| POST | `/api/projects` | Create project |
| POST | `/api/projects/:id/tasks` | Add task |
| POST | `/api/projects/:id/milestones` | Add milestone |
| GET | `/api/users` | List users |
| GET | `/api/dashboard/stats` | Dashboard statistics |
| GET | `/api/dashboard/ai-usage` | AI usage analytics |

### AI Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ai/analyze-proposal` | Proposal quality analysis |
| POST | `/api/ai/analyze-similarity` | Project similarity check |
| POST | `/api/ai/analyze-risk` | Project risk prediction |
| POST | `/api/ai/recommend-supervisor` | Supervisor recommendation |
| POST | `/api/ai/project-insights` | Generate project insights |
| POST | `/api/ai/project-summary` | Generate project summary |
| POST | `/api/ai/feedback-suggestions` | Feedback assistant |
| POST | `/api/ai/project-query` | Natural language query |

## Database Schema

- **users** — Students, supervisors, coordinators
- **proposals** — FYP proposal submissions
- **projects** — Active projects with health tracking
- **project_members** — Student-project mapping
- **milestones** — Project milestones with deadlines
- **tasks** — Granular tasks with assignment and status
- **meetings** — Scheduled/completed supervisor meetings
- **ai_analysis_cache** — Cached AI results with hash invalidation
- **ai_audit_log** — Complete AI operation audit trail
- **ai_rate_limits** — Per-user rate limiting
- **feedback** — Supervisor feedback records

## Demo Workflow

1. **Student** submits a proposal → View proposal quality analysis
2. **System** automatically checks for similar projects → Similarity report
3. **Coordinator** views supervisor recommendations → AI-matched supervisors
4. **Supervisor** uses feedback assistant → AI-suggested review points
5. **Project** is created → Track tasks, milestones, meetings
6. **System** monitors health → Risk prediction with explanations
7. **Any user** views project insights → Data-driven insights
8. **Any user** asks questions → Natural language project query

## Security

- API key stored in `.dev.vars` (never committed)
- All AI calls are backend-only (no client exposure)
- Authorization checks before data access
- PII minimization in AI context
- Rate limiting prevents abuse

## Running Locally

```bash
# Install dependencies
npm install

# Apply migrations
npm run db:migrate:local

# Seed demo data
npm run db:seed

# Build and start
npm run build
npm run preview
```

## Environment Variables

```
OPENROUTER_API_KEY=<your-key>
OPENROUTER_MODEL=google/gemma-4-26b-a4b-it:free
```

## Project Status
- **Platform**: Cloudflare Pages + D1
- **Status**: Fully functional with all 8 AI features
- **Last Updated**: 2026-08-08
