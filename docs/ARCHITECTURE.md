# System Architecture

This document describes the structural design, system boundaries, database metastores, and the end-to-end industrial computer vision pipeline of the FashionFlow AI application.

## System Boundaries

The application is decoupled into an independent frontend web client and a Python AI + database microservice:

```mermaid
graph TD
    User([User Browser / Smartphone Photo]) -->|Next.js UI| NextJS[Next.js Frontend - port 3000]
    NextJS -->|API Requests: /predict, /generate-doll-sheet, /search, /history| FastAPI[FastAPI Backend - port 8000]
    FastAPI -->|Dynamic Inference| ModelsDir[(models/ folder)]
    FastAPI -->|Dual Database Metastore| DB[(PostgreSQL + pgvector / SQLite)]
    DB -->|Sewing Machine CSVs| CSVs[(data/ Juki Catalogs)]
```

### 1. Frontend Web Client (Next.js Node Server)
* Serves the collapsible Codinglab dashboard UI (Design Input, Sewing Sequence, Tooling Recommendations, Doll Outfit Configurator, etc.).
* Collects garment sketch uploads, physical smartphone photos, and doll parameters from the user.
* Sends API requests to the FastAPI backend and renders structured process sheets dynamically (coordinates overlays, step-by-step tables with matching part icons, multi-fabric breakdowns, and estimated SMVs).

### 2. Python AI & Database Microservice (FastAPI Uvicorn Service)
* Runs independently on port `8000`.
* **AI Engine**: Loads YOLOv11, PyTorch (MobileNetV3/ResNet/CLIP), and computer vision pre-processors.
* **Database Metastore (`backend/db.py`)**: 
  * Automatically handles schema creation and database seeding.
  * Manages dual modes: SQLite (with numpy-based local vector search) or PostgreSQL (with native pgvector HNSW cosine searches).
  * Stores persistent analysis logs in the `analysis_history` table so that upload history is saved across server restarts.
  * Reads the Juki machinery catalogs (`data/juki_master_catalog.csv`) to seed the historical knowledge database and serve machine specs details on startup.

---

## Industrial Computer Vision & Engineering Retrieval Pipeline

To adapt to real-world factory workflows at industrial manufacturing facilities (where engineers photograph physical paper sketches or finished dolls using smartphone cameras under non-standard lighting and angles), FashionFlow employs a modular, non-destructive image processing pipeline:

```text
Smartphone Camera Input (Paper Sketch / Physical Doll Photo)
                       │
                       ▼
[CV-QUALITY] Stage 1: Image Quality Assessment  ← INTEGRATED ✅
   Resolution, Brightness, Contrast validation
   Output: quality_assessment dict (is_acceptable, width, height, brightness, contrast)
                       │
                       ▼
[CV-PERSPECTIVE] Stage 2: Perspective Correction & Unwarping  ← INTEGRATED ✅
   OpenCV Canny edge + contour detection + 4-point warpPerspective
   Output: processed_img (corrected or passthrough if no quad detected)
                       │
                       ▼
[CV-CROP] Stage 3: Object Localization & Auto-Crop  ← INTEGRATED ✅
   YOLO bbox_pct → crop_detected_garment() isolates garment region
   Fallback: full perspective-corrected frame used if no YOLO detection
                       │
                       ▼
[VECTOR-SEARCH] Stage 4: Feature Extraction (Meta DINOv2 Small: dinov2_vits14)  ← INTEGRATED ✅
   PyTorch Hub dinov2_vits14 → 384-dim L2-normalized visual vector embedding
   Input: processed_img (post-perspective + post-crop)
                       │
                       ▼
[VECTOR-SEARCH] Stage 5: pgvector / NumPy Cosine Similarity Search  ← INTEGRATED ✅
   MD5 shortcut first → PyTorch cosine similarity vs analysis_history
   Threshold: cosine ≥ 0.90 → REJECTED | MD5 match → REJECTED (99.8%)
                       │
                       ▼
Stage 6: Engineering Knowledge Retrieval (Juki Catalog CSV + RAG)  ← INTEGRATED ✅
   search_similar_garments() → historical_products pgvector query
                       │
                       ▼
Stage 7: LLM + Rule-Based Engineering Recommendation  ← INTEGRATED ✅
   Compiles sewing sequence, Juki machine choices, tooling specs, SMV estimates
```

### Key Engineering Principles:
* **Zero Workflow Friction**: Engineers do not need flatbed scanners. They continue taking photos with their smartphones while FashionFlow normalizes the input behind the scenes.
* **Multi-Component Assembly ("LEGO" Concept)**: For doll outfit sets containing multiple garments (e.g. jacket, pants, hat), Object Localization detects each component separately, crops them individually, and executes parallel vector searches for each garment component.
* **Similarity Search as Gateway**: Similarity search is not the end goal; it is the entry door to retrieve full **Engineering Knowledge Records** (Sewing sequence, Juki machinery, SMV, lessons learned).

---

## Real-time Feature Vector Extraction, Concurrency, and Duplication Control

FashionFlow features a zero-retraining visual similarity and duplication detection engine built into `backend/db.py` (`check_saved_history_similarity`).

### 1. Zero-Retraining Feature Vector Fingerprinting
* Model weights do **not** need retraining upon new image uploads.
* Upon image upload, PyTorch Meta DINOv2 Small (`dinov2_vits14` self-supervised Vision Transformer) converts the input pixels into a normalized **384-dimensional vector embedding** acting as a unique visual fingerprint.
* Vector embeddings are saved directly inside `analysis_history.result.visual_vector`.

### 2. Multi-Tier Similarity & Duplication Hierarchy
During image verification (`/api/predict`), the backend evaluates:
1. **PyTorch Visual Feature Cosine Distance**: Calculates $\cos(\theta) = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\| \|\mathbf{v}\|}$ against saved project vectors in `analysis_history`. If $\cos(\theta) \ge 0.92$, similarity is flagged at $\ge 92\%$ (triggering `REJECTED`).
2. **Exact Image MD5 Hash Match**: Hashes the base64 payload. Matches trigger `99.8%` similarity (`REJECTED`).
3. **Project Name String Normalization**: Normalizes whitespace and casing to detect duplicate project submissions.

### 3. Concurrency & Transactional Safety (1,000 Concurrent Users)
* **ACID Transaction Isolation**: PostgreSQL (`pgvector`) uses row-level locks and auto-incrementing primary key sequences. Concurrent submissions receive distinct primary key IDs without race conditions or overwrites.
* **HNSW Vector Index Scale**: Vector searches use **HNSW (Hierarchical Navigable Small World)** graphs, maintaining $O(\log N)$ logarithmic query latency ($5-15\text{ms}$) under high concurrency.
* **Atomic De-duplication (`UPDATE` vs `INSERT`)**: When re-submitting an existing project name, `save_analysis_to_db` executes an atomic `UPDATE` on the existing primary key ID instead of appending redundant duplicate rows.

### 4. Edge Case Mitigation Matrix

| Edge Case Scenario | System Behavior & Mitigation Mechanism | Result |
| :--- | :--- | :--- |
| **User uploads identical sketch image under a different project name** | Caught by PyTorch Visual Vector Cosine Similarity ($\ge 92\%$) and MD5 hash match against `analysis_history` records. | `REJECTED (99.8%)` & Production Blocked |
| **User submits identical project name with a modified sketch** | Caught by project name string normalization check in `save_analysis_to_db`. | Atomic `UPDATE` on existing ID (No Duplicate Rows) |
| **1,000 users upload identical sketch simultaneously** | Transaction 1 commits first (ID #1). Transactions 2-1000 running milliseconds later perform real-time vector search, detect ID #1, and reject remaining submissions. | 1 Saved Project + 999 `REJECTED` Block Alerts |

---

## WebGL/WebGPU 3D Asset Pipeline

* **Mannequin Base Mesh (Blender Preset)**: A low-poly mannequin model representing the doll torso, exported as a `.glb` binary asset.
* **Garment Meshes (Blender Presets)**: Standard garment types (Shirt, T-Shirt, Jacket, Pants, Skirt) modeled to fit the mannequin's dimensions, loaded/unloaded in React Three Fiber dynamically.
* **Dynamic Texture Mapping**: 2D fabric prints/motifs uploaded by artists/designers are processed as standard canvas textures and mapped in real-time onto the active 3D garment mesh material (UV coordinates). This provides instant visual alignment for designers and operators without expensive CPU/GPU cloth physics simulations.
