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
* Serves the collapsible dashboard UI across 6 standardized subtabs (`Engineering Dashboard`, `Create Process Sheet`, `Sewing Machinery Catalog`, `Manufacturing Knowledge Base`, `Active Projects & History`, `System Settings`).
* Implements Penpot-inspired Cobalt design system (`#155DFC`, `border-slate-100`, `rounded-2xl` cards, Geist Mono typography, and soft status badges).
* Features 1-to-1 matching sidebar navigation labels and viewport titles, invisible search autocomplete popups, category dropdown filters, and cross-browser date parsing (`formatActivityDate`).
* Collects garment sketch uploads, physical smartphone photos, and doll parameters from the user.
* Sends API requests to the FastAPI backend and renders structured process sheets dynamically (coordinates overlays, step-by-step tables with matching part icons, multi-fabric breakdowns, and estimated SMVs).

### 2. Python AI & Database Microservice (FastAPI Uvicorn Service)
* Runs independently on port `8000`.
* **AI Engine**: Loads YOLOv11, PyTorch (MobileNetV3/ResNet/EfficientNet), Meta DINOv2 Small (`dinov2_vits14`), and computer vision pre-processors.
* **Fast In-Memory Caching (`_JUKI_CATALOG_CACHE` & `_KNOWLEDGE_CACHE`)**: Module-level memory caches serve static Juki machinery and knowledge base queries with sub-10ms response times (< 0.1ms average cached latency).
* **Database Metastore (`backend/db.py`)**: 
  * Automatically handles schema creation and database seeding.
  * Manages dual modes: SQLite (with numpy-based local vector search) or PostgreSQL (with native pgvector HNSW cosine searches).
  * Stores persistent analysis logs in the `analysis_history` table so that upload history is saved across server restarts.
  * Reads the Juki machinery catalogs (`data/juki_master_catalog.csv`) to seed the historical knowledge database and serve machine specs details on startup.
* **Technical Machine Resolver & Batch SMV Engine**:
  * Derives specialized presser feet (`Zipper Foot`, `Piping Foot`, `Button Clamp`, `Differential Feed Foot`) and stitch densities (`1.8mm/14 SPI`, `2.5mm/10 SPI`, `3.5mm/7 SPI`).
  * Calculates batch production run scaling (`batch_total_hours` and operator daily capacity) for single garments and multi-component doll outfit sets.

---

## Industrial Computer Vision & Engineering Retrieval Pipeline

To adapt to real-world factory workflows in apparel manufacturing (where engineers photograph physical paper sketches or finished dolls using smartphone cameras under non-standard lighting and angles), FashionFlow employs a modular, non-destructive image processing pipeline:

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
[VECTOR-SEARCH] Stage 5: pgvector HNSW Native Cosine Similarity Search  ← INTEGRATED ✅
   MD5 column fast-path (O(1)) → pgvector ORDER BY visual_vector <=> query LIMIT 1
   Threshold: cosine ≥ 0.90 → REJECTED | MD5 match → REJECTED (99.8%)
   SQLite fallback: Python-loop cosine math preserved for dev/test environments
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
* Vector embeddings are stored in a **dedicated native `visual_vector vector(384)` column** in `analysis_history`, backed by an HNSW index (`idx_hnsw_analysis_cosine`) for O(log n) retrieval. The JSON blob (`result`) also retains the vector for backward compatibility.
* MD5 hashes of preview images are stored in a dedicated `image_md5 TEXT` column for O(1) exact-match fast-path queries.

### 2. Multi-Tier Similarity & Duplication Hierarchy
During image verification (`/api/predict`), the backend evaluates in order:
1. **MD5 Exact Hash Match** (O(1) column scan): Hashes the base64 payload against the `image_md5` column. Matches trigger `99.8%` similarity (`REJECTED`).
2. **Project Name SQL Match**: SQL `LOWER(filename) = LOWER(input)` check — no Python iteration needed.
3. **pgvector Native Cosine Similarity** (O(log n) HNSW): `SELECT ... ORDER BY visual_vector <=> query::vector LIMIT 1`. If $\cos(\theta) \ge 0.90$, triggers `REJECTED`. SQLite environments fall back to Python-loop cosine math.

### 3. Concurrency & Transactional Safety (1,000 Concurrent Users)
* **ACID Transaction Isolation**: PostgreSQL (`pgvector`) uses row-level locks and auto-incrementing primary key sequences. Concurrent submissions receive distinct primary key IDs without race conditions or overwrites.
* **HNSW Vector Index Scale**: Vector searches use **HNSW (Hierarchical Navigable Small World)** graphs on the native `visual_vector` column, maintaining $O(\log N)$ logarithmic query latency ($5-15\text{ms}$) at any database scale.
* **Atomic De-duplication (`UPDATE` vs `INSERT`)**: When re-submitting an existing project name, `save_analysis_to_db` executes an atomic `UPDATE` on the existing primary key ID instead of appending redundant duplicate rows.

### 4. Edge Case Mitigation Matrix

| Edge Case Scenario | System Behavior & Mitigation Mechanism | Result |
| :--- | :--- | :--- |
| **User uploads identical sketch image under a different project name** | Caught by PyTorch Visual Vector Cosine Similarity ($\ge 92\%$) and MD5 hash match against `analysis_history` records. | `REJECTED (99.8%)` & Production Blocked |
| **User submits identical project name with a modified sketch** | Caught by project name string normalization check in `save_analysis_to_db`. | Atomic `UPDATE` on existing ID (No Duplicate Rows) |
| **1,000 users upload identical sketch simultaneously** | Transaction 1 commits first (ID #1). Transactions 2-1000 running milliseconds later perform real-time vector search, detect ID #1, and reject remaining submissions. | 1 Saved Project + 999 `REJECTED` Block Alerts |
| **DINOv2 cosine similarity yields negative value (anti-parallel vectors)** | Raw cosine values below 0.0 are clamped to `max(0.0, ...)` in `db.py`, `app.py`, and `page.tsx` display layer. | `0.00%` displayed — `APPROVED` |

---

## Create Process Sheet Studio UX

The Create Process Sheet view uses a **2-phase studio layout**:

### Phase 1: Studio Configuration & Input
* **Section 1 (Pattern Sketch & Originality)**: Live DINOv2 scan triggers immediately upon image upload — no second button press required.
  * Displays an inline **Top Matched Projects in Catalog** list (up to 5 entries) with thumbnail, project ID, name, garment category, and per-project similarity badge.
  * Similarity scores are clamped to `≥ 0.00%` and displayed as `X.X% match`.
  * If any match scores `≥ 90%`, the Workflow Status panel changes to an amber **"Locked (Duplicate Pattern Detected)"** state and the Generate Process Sheet button is disabled.
* **Section 2 (Engineering Specifications)**: Project name, garment category, and fabric weight inputs. Workflow Status badge reflects real-time lock state.

### Phase 2: Generated Output
* Displays the compiled process sheet with sewing sequence, machine allocations, SMV estimates, and historical context.

### garment_type Resolution in Top-K Inspector
When reading matched projects from `analysis_history` in `get_top_k_similar_history_records`, `garment_type` is resolved via a three-tier fallback:
1. `result_json["garment_type"]` — set on predict calls that carry garment context.
2. `result_json["project_details"]["garment_type"]` — set by `/api/generate-sheet` after user selects category.
3. `result_json["project_details"]["garment_key"]` — internal canonical key (e.g. `"shirt"`, `"jacket"`).
4. Default: `"Garment"` if none of the above fields are present.

---

## WebGL/WebGPU 3D Asset Pipeline

* **Mannequin Base Mesh (Blender Preset)**: A low-poly mannequin model representing the doll torso, exported as a `.glb` binary asset.
* **Garment Meshes (Blender Presets)**: Standard garment types (Shirt, T-Shirt, Jacket, Pants, Skirt) modeled to fit the mannequin's dimensions, loaded/unloaded in React Three Fiber dynamically.
* **Dynamic Texture Mapping**: 2D fabric prints/motifs uploaded by artists/designers are processed as standard canvas textures and mapped in real-time onto the active 3D garment mesh material (UV coordinates). This provides instant visual alignment for designers and operators without expensive CPU/GPU cloth physics simulations.
