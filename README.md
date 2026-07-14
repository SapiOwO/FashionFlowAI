# FashionFlow AI — Garment Production Intelligence System

> **Intelligent pattern recognition + process sheet generation for garment production.**  
> Upload a garment sketch → AI checks design originality → Fill in parameters → Get a full production spec sheet with sewing steps, Juki machine recommendations, and SMV estimates.

*Last Updated: 2026-07-14*

---

## 📸 UI Screenshots & Training Results

### Application UI Screenshots

| System Workflow Dashboard | Originality Check & Quiz Form |
|:-:|:-:|
| ![System Workflow Dashboard](image/Dashboard.png) | ![Originality Check & Quiz Form](image/CreateProcessSheet.png) |

| Process Specification Sheet | Saved Projects Database |
|:-:|:-:|
| ![Process Specification Sheet](image/CreateProcessSheet2.png) | ![Saved Projects Database](image/ActiveProjects.png) |

| Pattern Originality Knowledge Base | All Juki Machinery Catalog |
|:-:|:-:|
| ![Pattern Originality Knowledge Base](image/KnowledgeBase.png) | ![All Juki Machinery Catalog](image/SewingToolsCatalog.png) |

### Training Loss Curves (Colab)

| MobileNetV3 Large | ResNet50 | EfficientNet-B0 |
|:-:|:-:|:-:|
| ![MobileNet Training Loss](image/mobilenet_training_loss.png) | ![ResNet50 Training Loss](image/resnet50_training_loss.png) | ![EfficientNet Training Loss](image/efficientnet_training_loss.png) |

> All three models were trained on the **Indonesian Batik Motifs (Corak App)** dataset — 10 batik classes, ~1,200 images — on Google Colab with GPU acceleration.  
> Accuracy: **94.2%** on final validation run.

---

## 🗂️ Project Architecture

```
fashionflowrework/
├── backend/
│   ├── app.py                      <-- FastAPI backend (port 8000)
│   │                                   - /api/predict          → Ensemble 3-model originality check
│   │                                   - /api/generate-sheet   → Process sheet compilation (multi-tier resolver)
│   │                                   - /api/validate-catalog → Catalog diagnostics & resolution checks
│   │                                   - /api/history          → Upload history CRUD
│   │                                   - /api/models           → Discover available .pth files
│   ├── db.py                       <-- Database handler (SQLite / PostgreSQL+pgvector)
│   └── tests/
│       └── test_backend_contract.py <-- 19 automated regression tests (step counts, machine matching, etc.)
├── frontend/
│   └── src/app/page.tsx            <-- Next.js frontend dashboard (port 3000)
├── data/
│   ├── machine_aliases.json        <-- Single Source of Truth for machine categories & resolver rules
│   ├── juki_master_catalog.csv     <-- Cleaned Juki Master Apparel Catalog
│   ├── 2025_general_apparel_e.csv  <-- Parsed Juki Apparel Catalog
│   ├── 2025_general_nonapparel_e.csv<-- Parsed Juki Non-Apparel Catalog
│   ├── sewing_templates.json       <-- Per-garment sewing step templates (Shirt, T-Shirt, Jacket, Pants, Skirt, Dress)
│   └── historical_products.csv   <-- Historical process records (seed data)
├── docs/
│   ├── ARCHITECTURE.md             <-- System boundaries & metastore docs
│   ├── CASE_STUDIES.md             <-- 5W+1H Diagnostic Matrix logs (Case Study #5 & #6)
│   ├── QUICKSTART.md               <-- Setup & run instructions
│   └── ROADMAP.md                  <-- Completed milestones vs roadmap
├── image/                          <-- UI screenshots & model training media storage
├── models/
│   ├── efficientnet_textiles.pth   <-- EfficientNet-B0 trained weights
│   ├── mobilenet_textiles.pth      <-- MobileNetV3 Large trained weights
│   └── resnet50_textiles.pth       <-- ResNet50 trained weights
├── Dockerfile.backend / Dockerfile.frontend / docker-compose.yml <-- Production container orchestration
├── import_csv.py                   <-- Seeds historical_products.csv into database
├── main.py                         <-- Unified launcher (starts both servers)
└── requirements.txt
```

---

## ⚙️ Setup & Installation

### 1. System Requirements

| Requirement | Version |
|---|---|
| Python | 3.10 or higher |
| Node.js | 18.x or higher |
| PyTorch | 2.x (CPU inference supported) |

### 2. Clone & Install

```bash
# 1. Activate Python virtual environment
python -m venv .venv

# Windows:
.venv\Scripts\Activate.ps1

# Mac/Linux:
source .venv/bin/activate

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Install Next.js dependencies
cd frontend
npm install
cd ..
```

### 3. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

### 4. Seed Historical Data (Optional)

```bash
python import_csv.py
```

---

## 🚀 Running the App & Tests

### Start the Unified Application

```bash
python main.py
```

This single command starts both servers:

| Server | URL |
|---|---|
| Frontend (Next.js) | http://localhost:3000 |
| Backend API (FastAPI) | http://127.0.0.1:8000 |
| API Health Check | http://127.0.0.1:8000/ |
| Catalog Diagnostic Endpoint | http://127.0.0.1:8000/api/validate-catalog |

### Run Backend Data Contract Tests

```bash
# Run 19 automated regression tests:
python -m pytest backend/tests/test_backend_contract.py -v
```

---

## 🐳 Production Deployment via Docker

```bash
# Build and run containers for frontend + backend:
docker compose up --build
```

---

## 📋 MVP Acceptance Criteria

| Criterion | Status |
|---|---|
| Upload a garment image or sketch | ✅ |
| Classify garment pattern originality | ✅ Ensemble of 3 models |
| Generate a draft sewing sequence | ✅ Template-driven per garment type |
| Recommend tooling and machine requirements | ✅ Matched via multi-tier resolver |
| Estimate complexity and SMV range | ✅ |
| Retrieve at least three similar historical examples | ✅ pgvector / numpy cosine search |
| Save and manage past project records | ✅ Persistent DB with rename/delete |
| Regression test coverage for data contracts | ✅ 19 automated unit tests |
