# HireFlow System Architecture

## Overview

HireFlow is a multi-layered SaaS platform organized around bounded contexts. Each context has clear service boundaries and communicates through well-defined API contracts.

---

## Bounded Contexts

### 1. Identity & Auth
**Responsibility:** User lifecycle, authentication, token management  
**Entities:** User  
**API:** `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`  
**Events:** `user.registered`, `user.login`  

### 2. Candidate Profile
**Responsibility:** Professional profile management  
**Entities:** CandidateProfile, WorkExperience, Education, Project, Certification, Skill, CandidatePreference  
**API:** `GET/POST/PUT /profiles/me`, `/profiles/me/experiences`, `/profiles/me/education`, etc.  
**Events:** `profile.updated`  

### 3. Resume/CV Builder
**Responsibility:** Resume version management, templates, rendering  
**Entities:** ResumeTemplate, ResumeVersion, CoverLetterVersion  
**API:** `GET/POST/PUT/DELETE /resumes`, `GET /resumes/templates`  
**Events:** `resume.created`, `resume.exported`  

### 4. Job Ingestion & Parsing
**Responsibility:** Store and parse job postings  
**Entities:** JobPosting, JobParseResult  
**API:** `POST /jobs`, `GET /jobs`, `GET /jobs/{id}/parse-result`  
**Background Jobs:** `parse_job_description`  

### 5. Job Matching
**Responsibility:** Score candidate-job fit  
**Entities:** JobMatch  
**API:** `GET /matches`  
**Algorithm:** Weighted scoring: skills (40%) + experience (25%) + education (15%) + location (10%) + salary (10%)  

### 6. Application Assistance
**Responsibility:** AI-generated content for applications  
**Entities:** CoverLetterVersion, ApplicationAnswer, QuestionBankEntry  
**API:** `POST /answers`, `GET /answers/bank`  

### 7. Application Tracking
**Responsibility:** CRM for job applications  
**Entities:** Application, ApplicationAnswer  
**API:** `GET/POST/PATCH/DELETE /applications`  
**State Machine:** saved → applied → screening → interviews → offer/reject  

### 8. Analytics
**Responsibility:** Funnel metrics and outcome tracking  
**Entities:** AnalyticsEvent  
**API:** `GET /analytics/dashboard`  

### 9. Admin & Observability
**Entities:** AuditLog  
**API:** Internal only  

---

## Data Flow

```
Browser/Extension
      │
      ▼
 Next.js Frontend (port 3000)
      │  REST API calls
      ▼
 FastAPI Backend (port 8000)
      │
      ├── PostgreSQL (port 5432)  ← persistent data
      ├── Redis (port 6379)       ← cache + Celery broker
      ├── S3/MinIO (port 9000)    ← file storage
      └── OpenAI API              ← AI generation
```

## Async Operations (Celery)

- Job description parsing
- Resume PDF/DOCX generation
- AI tailoring (resume + cover letter)
- Job match score computation
- Analytics event processing

---

## Security Model

- Passwords: bcrypt with cost factor 12
- Auth: JWT (HS256, 60-min access + 30-day refresh)
- Extension token storage: `chrome.storage.local` (Chrome-profile encrypted)
- CORS: Configured per environment
- Secrets: Environment variables only, never in code
- PII: User data isolated by `user_id` FK on all user-scoped tables
- Audit: All write operations should be logged to `audit_logs`

---

## Scalability Notes

- Stateless API → horizontal scaling ready
- Read-heavy paths (profile, jobs, matches) can be cached in Redis
- Background jobs scale independently via Celery workers
- S3 for file storage eliminates disk-based scaling concerns
- Database: use read replicas for analytics queries in Phase 5
