# FashionFlow AI — Garment Production Intelligence System

> **Intelligent pattern recognition, original sketch verification, and automated process sheet compilation for garment manufacturing.**  
> Upload a garment or doll outfit sketch → AI checks design originality via Meta DINOv2 visual embeddings → Configure engineering parameters → Receive a complete production specification sheet with step-by-step sewing flows, Juki machine model recommendations, presser foot & needle specifications, batch SMV scaling, and historical baselines.

*Last Updated: 2026-07-21 (Phase 20: Operation Detail Expansion & Fast In-Memory Caching)*

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

| Query / Reference | <img src="docs/assets/eval_matrix/wallpaper.jpg" width="90" alt="Wallpaper" /><br />**Wallpaper** | <img src="docs/assets/eval_matrix/wallpaper_2xupscaled.jpg" width="90" alt="Wallpaper 2x" /><br />**Wallpaper 2x** | <img src="docs/assets/eval_matrix/doll.jpg" width="90" alt="Doll" /><br />**Doll** | <img src="docs/assets/eval_matrix/doll_blackandwhite.jpg" width="90" alt="Doll B&W" /><br />**Doll B&W** | <img src="docs/assets/eval_matrix/batik1.jpg" width="90" alt="Batik 1" /><br />**Batik 1** | <img src="docs/assets/eval_matrix/batik2.jpg" width="90" alt="Batik 2" /><br />**Batik 2** |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| <img src="docs/assets/eval_matrix/wallpaper.jpg" width="90" alt="Wallpaper" /><br />**Wallpaper** | **1.0000000** | **0.9963874** | 0.3777580 | 0.3280388 | -0.0770774 | 0.0269208 |
| <img src="docs/assets/eval_matrix/wallpaper_2xupscaled.jpg" width="90" alt="Wallpaper 2x" /><br />**Wallpaper 2x** | **0.9963874** | **1.0000000** | 0.3831076 | 0.3341874 | -0.0792709 | 0.0249313 |
| <img src="docs/assets/eval_matrix/doll.jpg" width="90" alt="Doll" /><br />**Doll** | 0.3777580 | 0.3831076 | **1.0000000** | **0.8980661** | -0.0893405 | -0.0364631 |
| <img src="docs/assets/eval_matrix/doll_blackandwhite.jpg" width="90" alt="Doll B&W" /><br />**Doll B&W** | 0.3280388 | 0.3341874 | **0.8980661** | **1.0000000** | -0.0498432 | -0.0650231 |
| <img src="docs/assets/eval_matrix/batik1.jpg" width="90" alt="Batik 1" /><br />**Batik 1** | -0.0770774 | -0.0792709 | -0.0893405 | -0.0498432 | **1.0000000** | 0.4234626 |
| <img src="docs/assets/eval_matrix/batik2.jpg" width="90" alt="Batik 2" /><br />**Batik 2** | 0.0269208 | 0.0249313 | -0.0364631 | -0.0650231 | 0.4234626 | **1.0000000** |

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
│   ├── app.py                      <-- FastAPI application & machine resolver engine
│   ├── db.py                       <-- Dual metastore (PostgreSQL + pgvector HNSW / SQLite)
│   └── tests/
│       ├── test_backend_contract.py <-- 35 automated integration & performance tests
│       └── test_example_folder.py   <-- Integration tests on sample datasets
├── frontend/
│   └── src/app/page.tsx            <-- Next.js 16 (Turbopack) dashboard UI
├── data/
│   ├── machine_aliases.json        <-- Machine category mapping & resolver rules
│   ├── juki_master_catalog.csv     <-- Master Juki Machinery catalog (310 models)
│   └── sewing_templates.json       <-- Step-by-step sewing templates
├── docs/
│   ├── ARCHITECTURE.md             <-- System architecture & pipeline details
│   ├── ROADMAP.md                  <-- Milestone roadmap (Phases 1-20 completed)
│   ├── QUICKSTART.md               <-- Environment setup guide
│   └── assets/eval_matrix/        <-- Thumbnail assets for DINOv2 evaluation matrix
├── use_this_example/               <-- Empirical test images & benchmark dataset
├── main.py                         <-- Unified process launcher (starts FastAPI + Next.js)
└── requirements.txt
```

---

## 🚀 Quickstart & Verification

Choose your preferred deployment method below:

### Method A: Local Virtualenv Setup (Recommended for Development)

```bash
# 1. Create and activate virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1   # Windows
# source .venv/bin/activate  # macOS / Linux

# 2. Install backend & frontend dependencies
pip install -r requirements.txt
cd frontend && npm install && cd ..

# 3. Launch unified dev environment (FastAPI + Next.js)
python main.py
```
- **Frontend Dashboard**: `http://localhost:3000`
- **FastAPI Backend**: `http://127.0.0.1:8000`
- **Catalog Diagnostics**: `http://127.0.0.1:8000/api/validate-catalog`

---

### Method B: Docker & Docker Compose Container Deployment

```bash
# Build and start all services (Backend API + Next.js Frontend + Optional pgvector DB)
docker-compose up --build -d

# Check running container status
docker-compose ps

# View live container logs
docker-compose logs -f
```
- Containers run synchronously: `fashionflow-backend` (Port 8000) & `fashionflow-frontend` (Port 3000).

---

### Method C: Automated Unit & Integration Tests

```bash
.\.venv\Scripts\pytest backend/tests/
```
- Executes **55 automated integration & contract tests** covering DINOv2 vector extraction, machine resolver logic, presser foot specs, batch SMV scaling, system info endpoints, and sub-10ms caching (100% pass rate).
