---
title: "Case Studies #5 - #9: FashionFlow MVP Refactoring, Consolidated Catalogs, Parameter Alignment & Vector Retrieval Fixes"
date: "2026-07-19"
author: "AI Coding Agent"
status: "Completed"
---

# Document Index & Changelog Timeline

| Version | Date | Changes | Author |
| :--- | :--- | :--- | :--- |
| v1.0.0 | 2026-07-12 | Initial Next.js + FastAPI decoupled architecture implementation | AI Coding Agent |
| v1.1.0 | 2026-07-12 | Refactored UI to JUKI monitor mockup, integrated persistent database history, cleaned Juki PDFs using MarkItDown, and resolved Windows Ctrl+C batch prompt bug | AI Coding Agent |
| v1.2.0 | 2026-07-13 | Moved WSL model weights, added state-dict loaders, created DB history CRUD (rename/delete), and replaced dashboard mockups with system workflow guides | AI Coding Agent |
| v1.3.0 | 2026-07-13 | Consolidated separate Sewing Flow, Tooling, and SMV panels into a single unified Process Sheet dashboard, added Production Parameters Quiz (garment type, fabric weights), and wired Projects List details load actions | AI Coding Agent |
| v1.3.1 | 2026-07-13 | Removed premature database insertion on pattern check, and fixed handleAnalyze activeTab routing white screen bug | AI Coding Agent |
| v1.4.0 | 2026-07-14 | Data contract refactor: multi-tier machine resolver, machine_aliases.json canonical map, strict tooling derivation, frontend skeleton empty state, legacy re-hydration helper, garment key normalization fix, 19 automated regression tests | AI Coding Agent |
| v1.5.0 | 2026-07-14 | Consolidation of Juki CSV catalogs, unified sewing flow UI sync, added Next.js Skeleton UI & loaded items count progress bar, fixed slash-handling image URLs, database wipe and seeding | AI Coding Agent |
| v1.5.1 | 2026-07-18 | Synced Production Parameter dropdowns with exact fabric/garment database values, fixed DDL-9000C blank dark image fallback, and reset PostgreSQL auto-increment sequence IDs to 1 | AI Coding Agent |
| v1.6.0 | 2026-07-19 | Visual Vector Persistence & CV Pipeline Area Guards: persisted 384-dim visual vectors on process sheet creation, added 20% area ratio & 150x150px output size guards to perspective correction, decoupled frontend UI verdict from Batik model scores, added diagnostic similarity logging | AI Coding Agent |
| v1.7.0 | 2026-07-19 | DINOv2 2-Pipeline Upgrade: replaced MobileNetV3 Small feature extractor with Meta DINOv2 Small (dinov2_vits14) for Pipeline B (Visual Retrieval), pre-load model at startup, added 5 DINOv2 regression tests (26/26 total passing), documented decoupled Classification vs Embedding pipelines | AI Coding Agent |
| v1.8.0 | 2026-07-19 | Native pgvector Migration: added dedicated `visual_vector vector(384)` and `image_md5 TEXT` native columns to `analysis_history`, created HNSW index `idx_hnsw_analysis_cosine`, replaced Python-loop cosine scan with native SQL `ORDER BY visual_vector <=> query LIMIT k`, SQLite fallback preserved. 34/34 tests passing. | AI Coding Agent |

---

# Case Study #5: FashionFlow MVP Refactoring (v1.0.0 – v1.3.1)

## 5W+1H Diagnostic Matrix

### 1. What
* **Problem**: Initial frontend mockups were hardcoded, upload logs reset on refresh, sidebar navigation was incomplete, Ctrl+C blocked clean exits, Juki CSV catalogs were unstructured text, model weights were in WSL, and dashboard contained hardcoded statistics.
* **Solution**: Implemented `analysis_history` database table, redesigned sidebar, resolved Ctrl+C via `npm.cmd` subprocess, processed Juki PDFs via MarkItDown, moved model weights to production, implemented DB CRUD APIs, unified the Process Sheet workspace.

### 2. Who
* Clothing production operators and garment engineers.

### 3. Where
* Local desktop: Next.js port 3000, FastAPI port 8000, data/ directory.

### 4. When
* Phases 1–6, completed 2026-07-13.

### 5. Why
* Database-backed histories survive server restarts. Consolidated workspace reduces navigational complexity for operators.

### 6. How
* Modified `backend/db.py`, `backend/app.py`, `frontend/src/app/page.tsx`, processed PDFs with MarkItDown, moved .pth weights, implemented state-dict loaders.

---

# Case Study #6: Data Contract Refactor & Machine Resolver (v1.4.0)

## 5W+1H Diagnostic Matrix

### 1. What

* **Problem**:
  1. The `STEP-BY-STEP SEWING FLOW` table and `RECOMMENDED JUKI MACHINERY` cards showed completely different machines. The sewing table rendered per-step matches correctly, but the cards below always defaulted to the top-4 generic CSV entries (`DDL-9000C`, `LK-1900C`, `MEB-3200C`, `LK-1903S`) due to a silent fallback whenever primary derivation did not populate.
  2. T-Shirt selection (`quizGarment = "T-Shirt"`) displayed 6 Jacket steps (zipper assembly, hood attachment, flap operations) because the frontend had a hardcoded fallback array of Jacket steps rendered whenever `fullResult.sewing_sequence_detailed` was empty.
  3. The garment key normalization function iterated `garment_key_map` in non-deterministic dict order, causing `"T-Shirt"` and `"Kaos (T-Shirt)"` to resolve to the `"shirt"` template key instead of `"tshirt"`.
  4. The Garment Type dropdown showed incorrect step counts: Skirt displayed 5 steps (actual: 4) and Dress displayed 7 steps (actual: 5).
  5. Legacy projects loaded via `"Load Specs"` did not rebuild tooling cards from the sewing sequence, producing visible divergence between old projects and the current format.
* **Solution**:
  1. Created `data/machine_aliases.json` as the **canonical single source of truth** for all machine type mappings, preferred model priorities, weight synonyms, and garment key synonyms.
  2. Implemented `resolve_machine_for_step` with a strict 4-tier resolution chain: preferred model → category+weight → category-only → structured warn-and-skip (no silent fallback).
  3. Introduced `build_sewing_sequence` and `derive_tooling_from_sequence` shared helpers to guarantee that tooling cards are always a strict unique subset of the models in the sewing step table.
  4. Fixed `normalize_garment_key` with an explicit `PRIORITY_ORDER` list (`t-shirt` before `shirt`).
  5. Replaced the frontend hardcoded 6-step Jacket fallback with a clean empty skeleton state with actionable guidance text.
  6. Corrected all dropdown option labels to match exact step counts in `sewing_templates.json`.
  7. Added `rehydrateProjectPayload` migration helper to `handleLoadProject` for backward-compatible loading of legacy records.
  8. Added `/api/validate-catalog` diagnostic endpoint and regression test suite `backend/tests/test_backend_contract.py` (19 tests, all passing).

### 2. Who
* Clothing production operators whose machine recommendations and garment sewing sequences were incorrect, undermining trust in the AI system's outputs.

### 3. Where
* Next.js frontend (port 3000), FastAPI backend (port 8000). Root data contracts: `data/sewing_templates.json`, `data/juki_master_catalog.csv`, `data/machine_aliases.json` (new in v1.4.0).

### 4. When
* Identified and resolved during Phase 7 refactor session, 2026-07-14.

### 5. Why
* The silent top-4 CSV fallback was invisible at startup but visibly wrong in the UI. The hardcoded Jacket steps were a developer test fixture left in production frontend code. Centralizing machine type logic into `machine_aliases.json` ensures future garment type additions require a single-file change rather than scattered keyword edits across Python code.

### 6. How
* **Process**:
  1. Analyzed `backend/app.py` to identify the silent fallback path in both `/api/generate-sheet` and `/api/predict`.
  2. Analyzed `frontend/src/app/page.tsx` to locate the hardcoded 6-step Jacket array.
  3. Created `data/machine_aliases.json` with 4 canonical machine type aliases, weight synonym map, and garment key synonym map.
  4. Refactored `backend/app.py`: replaced inline keyword heuristics with `resolve_machine_for_step`, `build_sewing_sequence`, `derive_tooling_from_sequence`, and `normalize_garment_key`. Module-level `_JUKI_DB` and `_MACHINE_ALIASES` caches are loaded once at startup via `_load_static_data`.
  5. Fixed T-Shirt priority bug in `normalize_garment_key` via `PRIORITY_ORDER` list.
  6. Replaced frontend hardcoded fallback with a clean empty skeleton state row with guidance text.
  7. Fixed dropdown option strings to reflect actual template step counts.
  8. Added `rehydrateProjectPayload` to `handleLoadProject` for legacy compatibility.
  9. Created and ran `backend/tests/test_backend_contract.py`: 19 tests / 24 subtests — all passing.

---

# Case Study #7: Dataset Consolidation, UI Sync & Skeleton UI (v1.5.0)

## 5W+1H Diagnostic Matrix

### 1. What
* **Problem**:
  1. Machinery catalogs were split across multiple CSV files (apparel, non-apparel, parameters), causing redundant variations, inconsistent machine names (e.g. `PS-900/910` vs `PS-900`), and data mismatches.
  2. The `STEP-BY-STEP SEWING FLOW` table and `RECOMMENDED JUKI MACHINERY` cards displayed inconsistent recommended models.
  3. Image URLs with slashes `/` caused Next.js to return 404 HTTP errors.
  4. Large dataset loads caused visual stuttering and blank UI blocks before API data resolved.
* **Solution**:
  1. Consolidated all PDFs and TXTs into a single master `data/juki_master_catalog.csv`.
  2. Unified step-by-step sewing flow and machinery recommendation cards to dynamically query the same master CSV.
  3. Sanitized slashes `/` into dashes `-` in image filenames and mapped model names to clean image assets.
  4. Added Next.js Skeleton UI cards and a dynamic loaded items count progress bar (`Loaded X/Y`).
  5. Cleared and re-seeded the database table `historical_products` with 31 fabric parameters from the consolidated catalog.

### 2. Who
* Doll clothing designers, production operators, and pattern engineers requiring accurate machinery recommendations and smooth page transitions.

### 3. Where
* Next.js frontend, FastAPI backend, SQLite/PostgreSQL database, and the centralized `data/juki_master_catalog.csv` file.

### 4. When
* Phase 10 refactor session, completed on July 14th, 2026.

### 5. Why
* Consolidating the database into a single CSV source of truth eliminates duplicate/redundant catalog names and ensures matching data is always accurate. Adding progress indicators and skeleton loaders dramatically improves visual response time (UX) during async network calls.

### 6. How
* Run extraction via MarkItDown, merged records using Python data clean scripts, adjusted `clean_image_filename` in backend routes, updated UI rendering in `frontend/src/app/page.tsx` to handle loading progress, and ran SQL truncate to re-seed database parameters.

---

# Case Study #8: Parameter Alignment & Database ID Reset (v1.5.1)

## 5W+1H Diagnostic Matrix

### 1. What
* **Problem**:
  1. The dropdown list for `Fabric Type / Weight` in the Production Parameters UI form used generic value tags (`Light-weight`, `Medium-weight`, `Heavy-weight`) rather than matching the 31 specific fabric names from the CSV master catalog.
  2. The default image asset for `DDL-9000C.png` was blank and dark, displaying a black rectangle in the recommended machinery cards.
  3. Resetting the database with DELETE queries did not reset the PostgreSQL serial sequence ID, causing new project IDs to continue from 34 instead of starting from 1.
* **Solution**:
  1. Synced dropdown inputs in `frontend/src/app/page.tsx` to send exact fabric types matching the database (e.g. `Silk (Light-weight)`, `Cotton (Medium-weight)`, `Denim (Heavy-weight)`).
  2. Added a visual fallback in `clean_image_filename` to swap blank/dark `DDL-9000C.png` graphics with bright, clear Juki machine images (`DDL-8700L.png`).
  3. Reset the PostgreSQL auto-increment sequence ID to 1 using `TRUNCATE TABLE analysis_history RESTART IDENTITY;`.

### 2. Who
* Doll clothing designers compiling new process sheets and tracking project histories.

### 3. Where
* Production parameters form panel in Next.js, image sanitization route in FastAPI backend, and the local PostgreSQL database instance.

### 4. When
* Phase 11 optimization session, completed on July 18th, 2026.

### 5. Why
* Direct fabric name values ensure backend inference can accurately query matching parameters. Proper image fallbacks prevent broken visual grids. Resetting serial IDs to 1 maintains database hygiene and aligns record indexing with a clean slate.

### 6. How
* Replaced frontend dropdown options with aligned dataset records, modified image filename regex lookup in `backend/app.py`, and ran a PostgreSQL `TRUNCATE RESTART IDENTITY` query.

---

# Case Study #9: Visual Vector Persistence, Perspective Guards & Verdict Decoupling (v1.6.0)

## 5W+1H Diagnostic Matrix

### 1. What
* **Problem**:
  1. Uploading duplicate or upscaled versions of previously saved sketch images returned 0.0% database similarity score because `visual_vector` (the 384-dimensional PyTorch embedding) was extracted during `/api/predict` but omitted from the `/api/generate-sheet` payload, resulting in empty vector fields (`visual_vector = []`) when persisted to PostgreSQL/SQLite.
  2. OpenCV perspective correction (`correct_image_perspective`) detected minor non-paper contours in high-resolution digital illustrations and warped full images down to distorted 91×106px patches, causing extreme embedding feature drift.
  3. The Next.js frontend form panel and verdict banners checked `maxClassScore >= 95.0` against batik classification models, overriding the backend `status: "APPROVED"` response when non-batik images scored high confidence on irrelevant training classes (e.g., Batik Lasem 99.77%).
* **Solution**:
  1. Added `visual_vector` to `ProcessSheetRequest` in `backend/app.py` and `handleGenerateProcessSheet` in `frontend/src/app/page.tsx` so visual embeddings are saved to the `analysis_history` table upon process sheet creation.
  2. Implemented a 20% minimum contour area ratio guard and 150×150px minimum output dimension guard in `correct_image_perspective()` to prevent catastrophic warping on non-sketch/digital artwork.
  3. Decoupled frontend UI verdict evaluation to strictly check backend `status === "REJECTED"`, eliminating false positive form blocks caused by batik classification scores.
  4. Added verbose diagnostic logging in `check_saved_history_similarity()` (`db.py`) to output stored vector counts, per-record cosine similarity percentages, and threshold evaluation results.

### 2. Who
* Garment engineers and pattern designers uploading physical paper sketches or digital artwork requiring reliable duplicate pattern detection and process sheet creation.

### 3. Where
* FastAPI backend (`app.py`, `db.py`), Next.js frontend (`page.tsx`), and PostgreSQL (`pgvector`) / SQLite metastore.

### 4. When
* July 19th, 2026.

### 5. Why
* Persisting visual vectors guarantees that historical projects can be searched via cosine similarity. Adding area and size guards ensures OpenCV perspective transform applies only to physical paper sketches. Relying strictly on backend verdict status keeps UI state synchronized with database originality rules rather than unrelated ML classification outputs.

### 6. How
* Updated Pydantic request models and Next.js fetch payloads to pass `visual_vector`, updated contour filtering logic in `correct_image_perspective()`, simplified UI boolean expressions in `page.tsx`, and verified test suite execution (`backend/tests/test_backend_contract.py` 21/21 OK, `npm run build` PASS).



---

# Case Study #10: DINOv2 2-Pipeline Visual Retrieval Upgrade (v1.7.0)

## 5W+1H Diagnostic Matrix

### 1. What
* **Problem**:
  1. The existing `extract_visual_feature_vector()` function re-instantiated `MobileNetV3 Small` on every single call to `/api/predict`, causing redundant model weight loading overhead per request.
  2. `MobileNetV3 Small` was originally trained as a supervised ImageNet classifier. Its convolutional feature maps, when truncated to 384 dimensions, produced embeddings that were sensitive to garment label categories (e.g. Batik Lasem vs Batik Kawung) rather than capturing geometry-agnostic visual fingerprints suitable for rotation/lighting-robust similarity retrieval.
  3. The system architecture conflated two separate AI responsibilities into a single inference pass: garment type classification (Pipeline A) and visual similarity retrieval (Pipeline B). This caused conceptual confusion when evaluating similarity search results against classification confidence scores.
* **Solution**:
  1. Replaced `MobileNetV3 Small` with Meta **DINOv2 Small (`dinov2_vits14`)** — a self-supervised Vision Transformer trained on 142M diverse images. DINOv2 produces geometry-aware, rotation/lighting/scale-robust 384-dim L2-normalized visual fingerprints without task-specific fine-tuning or dataset retraining.
  2. Pre-loaded `dinov2_vits14` once at application startup inside `_load_static_data()` (called by `lifespan`) into the module-level `_DINO_MODEL` cache. Extracted a module-level `_DINO_PREPROCESS` transform pipeline (ImageNet normalization → 224×224 resize → ToTensor). Zero per-request model re-instantiation.
  3. Documented the **2-Pipeline Architecture** explicitly in code comments and documentation:
     - **Pipeline A (Classification/Recognition):** OpenCV + YOLO + MobileNetV3-Large/ResNet50/EfficientNet-B0 classify garment type label (`T-Shirt`, `Shirt`, etc.) from image visual features.
     - **Pipeline B (Visual Embedding & Retrieval):** DINOv2 converts the cropped garment image into a 384-dim coordinate in visual space. PostgreSQL `pgvector` (HNSW index) finds the Top-3 nearest historical engineering records by cosine distance. Metadata (garment type, sewing sequence, Juki machine, SMV, tooling) is then retrieved from those matched records.
  4. Added 5 DINOv2 regression tests to `backend/tests/test_backend_contract.py`: output shape `(384,)`, L2 norm == 1.0, cosine similarity for identical images == 1.0, cosine similarity for dissimilar images < 0.92, all elements float type.

### 2. Who
* Garment engineers and pattern designers at industrial manufacturing facilities uploading paper sketches or digital artwork requiring rotation/lighting-robust duplicate pattern detection and similar historical project retrieval.

### 3. Where
* FastAPI backend (`backend/app.py`): `extract_visual_feature_vector()`, `_load_static_data()`, `_DINO_MODEL`, `_DINO_PREPROCESS` globals.
* Regression test suite: `backend/tests/test_backend_contract.py` (`TestDINOv2FeatureExtractor` class).

### 4. When
* July 19th, 2026 (Phase 13 — DINOv2 Feature Extractor Upgrade).

### 5. Why
* DINOv2 (`dinov2_vits14`) was explicitly designed by Meta AI Research for self-supervised visual representation learning, producing embeddings suitable for retrieval, clustering, and nearest-neighbor search across rotation, scale, and lighting variations — precisely the use case required by FashionFlow's visual similarity pipeline. Pre-loading at startup eliminates redundant model initialization overhead on the critical `/api/predict` hot path. The 2-pipeline architecture separation aligns with Industrial MVP requirements, which explicitly distinguish between Classification (garment recognition) and Similarity Search (historical knowledge retrieval).

### 6. How
* Replaced `mobilenet_v3_small` inside `extract_visual_feature_vector()` with the module-level `_DINO_MODEL` cache (`dinov2_vits14`).
* Added DINOv2 model loading block inside `_load_static_data()` with `torch.hub.load("facebookresearch/dinov2", "dinov2_vits14", verbose=False)` and `.eval()`.
* Added `_DINO_MODEL = None` and `_DINO_PREPROCESS` module-level globals.
* Added `import torchvision` at top of `app.py` to support module-level transform pipeline.
* Added `_load_static_data()` call to `lifespan()` context manager to ensure DINOv2 loads at server startup before any request is processed.
* Added 5 regression tests to `TestDINOv2FeatureExtractor` class.
* Verified full test suite: **26/26 tests passed** (21 original + 5 new DINOv2 tests).


---

# Case Study #11: Native pgvector HNSW Migration (v1.8.0)

## 5W+1H Diagnostic Matrix

### 1. What
* **Problem**: Despite PostgreSQL `pgvector` being enabled and `historical_products` already using native `embedding vector(384)` with HNSW index, the `analysis_history` table stored visual vectors inside a JSON blob (`result TEXT`). Both `check_saved_history_similarity()` and `get_top_k_similar_history_records()` performed full Python-loop linear scans: fetch all rows → decode JSON → compute cosine manually. This was O(n) — negating the entire benefit of HNSW indexing.
* **Resolution**: Added dedicated native `visual_vector vector(384)` and `image_md5 TEXT` columns to `analysis_history`. Created `idx_hnsw_analysis_cosine` HNSW index. Replaced Python loops with native SQL `ORDER BY visual_vector <=> query::vector LIMIT k`. Idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` applied at startup so existing deployments migrate safely.

### 2. Who
* Any deployment where `analysis_history` grows beyond tens of records. At small scale the O(n) loop is imperceptible; at enterprise scale (1,000+ projects) the loop becomes a latency bottleneck while the HNSW index maintains sub-10ms query time.

### 3. Where
* `backend/db.py`: `init_database()` (schema migration), `save_analysis_to_db()` (native insert/update), `check_saved_history_similarity()` (pgvector query), `get_top_k_similar_history_records()` (pgvector Top-K query).
* `docs/ARCHITECTURE.md`: Updated Stage 5 pipeline description and sections 1–3 of Real-time Feature Vector chapter.

### 4. When
* July 19th, 2026 (Phase 14 — Database Native Vector Column Migration).

### 5. Why
* The previous implementation was architecturally inconsistent: HNSW index existed on `historical_products` but not `analysis_history` (the primary similarity target). At database scale:
  * **10 records** — O(n) loop is negligible (~1ms).
  * **1,000 records** — O(n) loop is ~50ms; HNSW would be ~2ms.
  * **100,000 records** — O(n) loop is ~5,000ms; HNSW remains ~5ms.
* The idempotent `ADD COLUMN IF NOT EXISTS` pattern was chosen over a full migration script to allow safe zero-downtime deployment on existing databases.
* SQLite fallback was preserved: SQLite does not support `vector(384)` native columns, so the Python-loop path remains active for local development and CI environments.

### 6. How
* `init_database()` (PostgreSQL path): Added `CREATE TABLE` with `visual_vector vector(384)` and `image_md5 TEXT`, followed by `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` guards for existing tables. Created `idx_hnsw_analysis_cosine` HNSW index.
* `save_analysis_to_db()` (PostgreSQL path): Extracts `visual_vector` list from `result_data`, formats as `[v1,v2,...v384]` pgvector literal, computes MD5 of preview image base64, stores both as native columns alongside JSON blob.
* `check_saved_history_similarity()` (PostgreSQL path): Three-stage native SQL cascade — (1) `WHERE image_md5 = %s` O(1), (2) `LOWER(filename)` name match, (3) `ORDER BY visual_vector <=> %s::vector LIMIT 1` HNSW Top-1 with `>= 90%` threshold decision.
* `get_top_k_similar_history_records()` (PostgreSQL path): Single SQL `ORDER BY visual_vector <=> %s::vector LIMIT %s` query, returns Top-K with `cosine_pct` computed as `ROUND((1 - (visual_vector <=> query)) * 100, 1)`.
* Log output changed from `Scanning N DB records / Comparing vs '...'` loop to `pgvector HNSW → Top-1: '...'` single-line result.
* Full test suite verification: **34/34 tests passed** (30 contract + 4 integration tests with real images from example folder).
