# PR Quest: Distributed & Gamified Hierarchical Code Reviewer

PR Quest is a distributed, collaborative code review workspace designed to transform reviewing complex and agentic pull requests into an engaging, structured review quest.

---

## Key Features

### 1. Distributed Collaborative Review Workflow
- **Multi-Reviewer Collaboration**: Staff Engineers, AppSec Architects, and QA Leads review the same PR collaboratively.
- **Mandatory Flag Comments**: When any reviewer flags a code bit or file, they are prompted to provide an explanation comment for their team.
- **Peer Comments & Flag Visibility**: Reviewers opening a file see peer flags, author names, role badges, avatars, and timestamps directly on the diff with instant reply capability.
- **Team Review Verdicts & Handoff**: Each reviewer submits their own independent verdict (`Approve`, `Request Changes`, or `Comment`). Team verdicts are aggregated so peers can pick up from where others left off.

### 2. Query-Based State Persistence (Simplest SQLite DB)
- **State Maintained Against Each Query**: Independent review progress, file approvals, comments, and verdicts are saved against PR / query IDs (e.g. `PR-101`, `PR-102`, or custom PR IDs).
- **Embedded SQLite Database (`data/pr_quest.db`)**: 
  - Ultra-simple 3-table schema (`users`, `review_queries`, `user_progress`).
  - Zero external database provisioning, zero cloud accounts, zero credentials needed.
  - Native SQLite support in Node 22+ with automatic persistent JSON fallback.
- **Live DB Sync Indicator**: Displays live synchronization status (`● Saved to DB` / `● Syncing...` / `● Offline DB`).

### 3. Reviewer Identity & 1-Click Fast Switch
- **Pre-configured Reviewer Personas**:
  - **reviewer_1**
  - **reviewer_2**
  - **reviewer_3**
- **1-Click Switching**: Seamlessly test peer reviews and handoffs without entering passwords. Custom registration and sign-in are also supported.

### 4. 4-Stage Hierarchical Review Progression
- **Level 1**: Spec & Acceptance Criteria Alignment
- **Level 2**: Core Architecture & Excalidraw Visual Audit
- **Level 3**: Blast Radius & Downstream Function Inspection
- **Level 4**: Roomy Test Matrix & Final Review Sign-Off

---

## Running Locally

### Development Mode
```bash
# Terminal 1: Start Backend API & SQLite Server (port 3001)
npm run server

# Terminal 2: Start Vite Dev Server with API Proxy (port 5174)
npm run dev
```

### Full-Stack Production Mode (Single Port)
```bash
# Build frontend and serve everything on port 3001
npm run build
npm start
```
Open [http://localhost:3001](http://localhost:3001) in your browser.

---

## Deployment (Path of Least Resistance)

Given minimal time, this app can be deployed with zero database configuration:

### Option A: Render / Railway / Fly.io (Zero Config)
1. Push this repository to GitHub/GitLab.
2. In **Render** or **Railway**:
   - Create a **New Web Service**.
   - Set **Root Directory**: `apps/web_app_pr_quest_gamified_hier`
   - Set **Build Command**: `npm run build`
   - Set **Start Command**: `npm start`
3. That's it! Render/Railway will build the React frontend and run the Node/SQLite server on a single public URL.

### Option B: Docker (Single Command)
```bash
docker build -t pr-quest apps/web_app_pr_quest_gamified_hier
docker run -p 3001:3001 -v $(pwd)/data:/app/data pr-quest
```