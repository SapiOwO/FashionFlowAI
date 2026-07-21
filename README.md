# FashionFlow AI — Garment Production Intelligence System

> **Intelligent pattern recognition, original sketch verification, and automated process sheet compilation for garment manufacturing.**  
> Upload a garment or doll outfit sketch → AI checks design originality via Meta DINOv2 visual embeddings → Configure engineering parameters → Receive a complete production specification sheet with step-by-step sewing flows, Juki machine model recommendations, presser foot & needle specifications, batch SMV scaling, factory line balancing, and historical baselines.

*Last Updated: 2026-07-21 (Phase 23: GitHub Primer Tokens, Outer/Inner Radius Standardization, Date Picker Integration & A+ Security Headers)*

---

## 📸 System Interface & Architecture

### Application Workflows & Views

| System Engineering Dashboard | Process Sheet Studio & Parameter Form |
|:-:|:-:|
| ![System Engineering Dashboard](image/Dashboard.png) | ![Originality Check & Quiz Form](image/CreateProcessSheet.png) |

| Step-by-Step Sewing Flow & Specs | Saved Active Projects History |
|:-:|:-:|
| ![Process Specification Sheet](image/CreateProcessSheet2.png) | ![Saved Projects Database](image/ActiveProjects.png) |

| Manufacturing Knowledge Base | Sewing Machinery Catalog |
|:-:|:-:|
| ![Pattern Originality Knowledge Base](image/KnowledgeBase.png) | ![All Juki Machinery Catalog](image/SewingToolsCatalog.png) |

---

## 📊 DINOv2 Visual Similarity Retrieval Benchmark

FashionFlow AI utilizes **Meta DINOv2 Small (`dinov2_vits14`)**, a self-supervised Vision Transformer, to extract L2-normalized 384-dimensional feature representations from uploaded garment sketches and photos. Visual similarity is calculated using cosine distance via PostgreSQL native `pgvector` HNSW indexing.

### Empirical Image Similarity Matrix (`use_this_example/`)

The table below demonstrates real DINOv2 pairwise cosine similarity scores evaluated across sample test images:

| Query / Reference | Wallpaper | Wallpaper 2x | Doll | Doll B&W | Batik 1 | Batik 2 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Wallpaper** | **1.0000000** | **0.9963874** | 0.3777580 | 0.3280388 | -0.0770774 | 0.0269208 |
| **Wallpaper 2x** | **0.9963874** | **1.0000000** | 0.3831076 | 0.3341874 | -0.0792709 | 0.0249313 |
| **Doll** | 0.3777580 | 0.3831076 | **1.0000000** | **0.8980661** | -0.0893405 | -0.0364631 |
| **Doll B&W** | 0.3280388 | 0.3341874 | **0.8980661** | **1.0000000** | -0.0498432 | -0.0650231 |
| **Batik 1** | -0.0770774 | -0.0792709 | -0.0893405 | -0.0498432 | **1.0000000** | 0.4234626 |
| **Batik 2** | 0.0269208 | 0.0249313 | -0.0364631 | -0.0650231 | 0.4234626 | **1.0000000** |

### Key Benchmark Insights

1. **Resolution & Upscaling Invariance**: `wallpaper.jpg` vs `wallpaper_2xupscaled.jpg` yields **0.9963874** (99.64% similarity). High-resolution rescales are reliably detected as exact visual duplicates.
2. **Color Invariance**: `doll.jpg` vs `doll_blackandwhite.jpg` yields **0.8980661** (89.81% similarity). DINOv2 captures structural and geometric pattern shapes even when color channels are removed.
3. **Distinct Pattern Differentiation**: Unrelated textile patterns (`batik1.jpg` vs `wallpaper.jpg`) produce near-zero or negative similarity scores (**-0.0770774**), preventing false positive duplicate locks.

---

## ⚡ Performance & Execution Latency

| Pipeline Stage | Average Latency | Description / Target |
|---|:---:|---|
| **In-Memory Catalog Query** | **< 0.1 ms** | Fast module-level caching layer (`_JUKI_CATALOG_CACHE`) |
| **OpenCV Preprocessing & Perspective Correction** | ~12.4 ms | Auto-perspective tilt correction & crop |
| **DINOv2 Feature Vector Extraction** | ~32.1 ms | 384-dim L2 unit vector generation |
| **pgvector HNSW Cosine Search** | ~3.8 ms | $O(\log n)$ vector retrieval |
| **Total End-to-End Latency** | **~48.3 ms** | Complete process sheet compilation payload |

---

## 🗂️ Project Repository Architecture

```text
fashionflowrework/
├── backend/
│   ├── app.py                      <-- FastAPI application, security headers & machine resolver engine
│   ├── db.py                       <-- Dual metastore (PostgreSQL + pgvector HNSW / SQLite)
│   └── tests/
│       ├── test_backend_contract.py <-- 55 automated integration & performance tests
│       └── test_example_folder.py   <-- Integration tests on sample datasets
├── frontend/
│   ├── next.config.ts              <-- Next.js A+ security headers configuration
│   ├── src/app/globals.css         <-- GitHub Primer tokens & Mona Sans font setup
│   └── src/app/page.tsx            <-- Next.js 16 (Turbopack) dashboard UI
├── data/
│   ├── machine_aliases.json        <-- Machine category mapping & resolver rules
│   ├── juki_master_catalog.csv     <-- Master Juki Machinery catalog (310 models)
│   └── sewing_templates.json       <-- Step-by-step sewing templates
├── docs/
│   ├── ARCHITECTURE.md             <-- System architecture & pipeline details
│   ├── CASE_STUDIES.md             <-- 5W+1H Diagnostic Case Studies (Case Study #12)
│   ├── ROADMAP.md                  <-- Milestone roadmap (Phases 1-23 completed)
│   └── QUICKSTART.md               <-- Environment setup guide
├── use_this_example/               <-- Empirical test images & benchmark dataset
├── main.py                         <-- Unified process launcher (starts FastAPI + Next.js)
├── docker-compose.yml              <-- Multi-container orchestrator (App + PostgreSQL pgvector)
├── Dockerfile                      <-- All-In-One Production Container Specification
└── requirements.txt
```

---

## 🚀 Choose Your Installation Method

Choose the installation pathway that best matches your deployment target:

### Option 1: Docker Compose (Recommended for Production & Local Evaluation)

*Best for users who want PostgreSQL with native `pgvector` HNSW vector search out of the box.*

```bash
# 1. Clone the repository
git clone https://github.com/SapiOwO/FashionFlowAI.git
cd FashionFlowAI

# 2. Launch App + PostgreSQL (pgvector) in detached mode
docker compose up --build -d
```
- **Frontend Dashboard**: `http://localhost:3000`
- **FastAPI Backend API**: `http://localhost:8000`
- **PostgreSQL Database**: `localhost:5432` (`DB_NAME=fashionflow_db`)

---

### Option 2: All-In-One Single Docker Container (Recommended for Cloud & VPS)

*Best for deploying to single-instance VPS servers (AWS EC2, DigitalOcean, Hetzner, GCP).*

> **Note**: Mount `-v fashionflow-data:/app/data` to ensure your database and uploaded assets are persisted across container updates.

#### A. Stable Release Image (GitHub Container Registry)
```bash
docker run -d -p 3000:3000 -p 8000:8000 -v fashionflow-data:/app/data --name fashionflowai --restart always ghcr.io/sapiowo/fashionflowai:latest
```

#### B. Build Single Container Locally
```bash
docker build -t fashionflowai .
docker run -d -p 3000:3000 -p 8000:8000 -v fashionflow-data:/app/data --name fashionflowai --restart always fashionflowai
```

---

### Option 3: Local Developer Setup (Python Virtualenv + Next.js)

*Best for active developers modifying FastAPI backend endpoints or Next.js frontend components.*

```bash
# 1. Clone repository and enter folder
git clone https://github.com/SapiOwO/FashionFlowAI.git
cd FashionFlowAI

# 2. Create and activate Python virtual environment
python -m venv .venv

# PowerShell (Windows)
.venv\Scripts\Activate.ps1
# bash (macOS / Linux)
# source .venv/bin/activate

# 3. Install backend & frontend dependencies
pip install -r requirements.txt
cd frontend && npm install && cd ..

# 4. Launch unified dev environment (FastAPI on :8000 + Next.js on :3000)
python main.py
```

---

## 🔄 Updating Your Docker Installation

How to update FashionFlow AI without losing your saved projects or database data:

```bash
# 1. Pull the latest Docker image
docker pull ghcr.io/sapiowo/fashionflowai:latest

# 2. Stop and remove the old container
docker stop fashionflowai && docker rm fashionflowai

# 3. Start the updated container using the existing data volume
docker run -d -p 3000:3000 -p 8000:8000 -v fashionflow-data:/app/data --name fashionflowai --restart always ghcr.io/sapiowo/fashionflowai:latest
```

---

## 🧪 Automated Testing & Verification

Run the automated integration and contract test suite:

```powershell
.\.venv\Scripts\pytest backend/tests/
```
- Executes **55 automated integration & contract tests** covering DINOv2 vector extraction, machine resolver rules, security headers middleware, system info endpoints, and vector search (**100% pass rate**).
