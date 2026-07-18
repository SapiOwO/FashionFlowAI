# Project Roadmap & Hand-off Checklist

This roadmap outlines what has been implemented in the FashionFlow AI project and what remains pending for your team to build.

## Completed Milestones (Done)

* **Phase 1: Collapsible Sidebar & Styling**
  * Implemented light theme and restored premium blue dashboard accents.
  * Created collapsible sidebar supporting 9 view panels.
* **Phase 2: Decoupled Project Structure**
  * Established Next.js Node app (port 3000) and FastAPI Python app (port 8000).
  * Built unified launcher script (`main.py`) with clean Ctrl+C exits.
* **Phase 3: Database & Importer Integration**
  * Programmed dual database backend (SQLite for default / PostgreSQL for production pgvector).
  * Created `import_csv.py` for seeding historical products from `data/historical_products.csv`.
  * Added persistent database-backed history logging for upload logs.
* **Phase 4: Juki Catalog PDF Parsing**
  * Installed Microsoft **MarkItDown** dependencies inside `.venv`.
  * Extracted PDF tables and compiled clean structured CSV datasets (`data/2025_general_apparel_e.csv` and `data/2025_general_nonapparel_e.csv`).
  * Built backend dynamic machine recommendations API which queries Juki CSV catalogs based on fabric weight.
  * Added `/` root system diagnostic health check endpoint for developers.
* **Phase 5: Model Weights & Database CRUD Integration**
  * Cut and moved trained weights (`efficientnet_textiles.pth`, `mobilenet_textiles.pth`, `resnet50_textiles.pth`) into the project's production `models/` directory.
  * Implemented state-dict loaders in backend FastAPI to instantiate torchvision architectures for MobileNet/ResNet/EfficientNet weights correctly.
  * Created database CRUD APIs for DELETE and PUT supporting renaming and deleting upload histories.
  * Added Actions column and a three-dots menu dropdown on the Projects tab, complete with confirmation dialogs.
  * Removed mockup statistics and AI architecture texts, replacing them with a step-by-step System Workflow Guide.
* **Phase 6: Unified Process Sheet & Quiz Workflow**
  * Merged Sewing Flow table, Juki recommendations, and SMV estimations onto a single comprehensive dashboard screen inside the "Create Process Sheet" workspace.
  * Integrated custom project name text inputs and Garment Type/Fabric Weight selectors that dynamically generate steps and machine matches.
  * Added "Load Specs" option inside Projects actions dropdown, allowing operators to instantly load and inspect any past analysis results.
  * Cleaned up the Next.js sidebar from 9 redundant links to 4 core navigations.

* **Phase 7: Data Contract Refactor & Machine Resolver**
  * Created `data/machine_aliases.json` as canonical machine type mapping and alias lookup — single source of truth for all resolver logic.
  * Implemented 4-tier multi-tier machine resolver (`resolve_machine_for_step`) in `backend/app.py`: preferred model → category+weight match → category-only match → structured warn-and-skip (no silent fallback).
  * Added `build_sewing_sequence` and `derive_tooling_from_sequence` canonical helpers that guarantee strict synchronization between sewing steps and recommended JUKI machinery cards.
  * Removed hardcoded 6-step Jacket fallback from `frontend/src/app/page.tsx` and replaced with a clean empty/skeleton state.
  * Corrected all Garment Type dropdown step labels to match `sewing_templates.json` (Skirt: 4, Dress: 5).
  * Added `rehydrateProjectPayload` migration helper to ensure legacy database projects load with the current normalized schema.
  * Added `/api/validate-catalog` diagnostic endpoint for verifying all template machine types resolve to real catalog entries.
  * Created `backend/tests/test_backend_contract.py` with 19 automated regression tests (all passing).
* **Phase 8: QOL Navigation & Modern E-commerce E-commerce Layout**
  * Renamed sidebar navigation items: `"All Sewing Tools"` ➔ `"Machine Catalog"` and `"Knowledge Base"` ➔ `"Garment Type Catalog"`.
  * Restructured the Machine Catalog view into a modern e-commerce 2-column layout containing a Left Accordion Filter Drawer and a Right Product Catalog Grid.
  * Added dropdown accordion filter options for needle size, presser foot type, fabric weight, and machine category, with collapsible chevron toggle headers.
  * Added dual-range slider bounds filtering max speed RPM (1,500 to 6,000) and max stitch length (1.0 to 10.0 mm).
  * Added top header "Kategori" Mega-Menu dropdown next to the brand logo to route across tops, bottoms, and machinery families.
* **Phase 9: Multi-Container Docker Infrastructure**
  * Created optimized Dockerfiles for Next.js frontend (multi-stage alpine runner) and FastAPI backend (slim python runner with dependencies).
  * Built orchestration layout using `docker-compose.yml` configured for dev SQLite/postgres pgvector DB modes.
* **Phase 10: Master CSV Consolidation & Skeleton UI**
  * Consolidated separate PDF and TXT datasets into a single source of truth: `data/juki_master_catalog.csv`.
  * Unified the Step-by-Step Sewing Flow table and Recommended Juki Machinery cards.
  * Added animated Skeleton UI cards and dynamic loaded items progress bar indicators to the catalog view.
  * Sanitized forward slashes in machine model names to prevent Next.js image loading 404 HTTP errors.
* **Phase 11: Production Form Alignment & Sequence Reset**
  * Synced Production Parameter dropdown selections to map directly to the 31 fabric parameters in the database.
  * Swapped blank dark `DDL-9000C.png` image with a bright and clear visual fallback (`DDL-8700L.png`).
  * Reset the PostgreSQL auto-increment primary key sequence for the project history table to start at 1.
* **Phase 12: Visual Vector Persistence & CV Pipeline Area Guards**
  * Added `visual_vector` to `ProcessSheetRequest` in `app.py` and `handleGenerateProcessSheet` payload in `page.tsx` so visual embeddings are persisted to the database upon process sheet creation.
  * Added 20% minimum contour area ratio and 150×150px output size guards to `correct_image_perspective()` to prevent catastrophic warping on non-sketch/digital images.
  * Decoupled frontend UI verdict banners and right panel form visibility to strictly rely on backend `status` (`REJECTED` / `APPROVED`), eliminating Batik classification score false positives.
  * Enhanced `check_saved_history_similarity()` in `db.py` with verbose diagnostic logging for vector search counts, per-record cosine scores, and verdict thresholds.
* **Phase 13: DINOv2 Feature Extractor Upgrade & 2-Pipeline Architecture (v1.7.0)**:
  * Replaced `MobileNetV3 Small` feature extractor with Meta **DINOv2 Small (`dinov2_vits14`)** for Pipeline B (Visual Embedding & Retrieval).
  * Pre-loaded `dinov2_vits14` once at startup into `_DINO_MODEL` module-level cache — zero per-request model re-instantiation.
  * Documented explicit **2-Pipeline Architecture**: Pipeline A (Classification: YOLO + MobileNetV3-L/ResNet50/EfficientNet-B0) decoupled from Pipeline B (Visual Retrieval: DINOv2 → pgvector HNSW → Top-3 Historical Records).
  * Added 5 DINOv2 regression tests to `backend/tests/test_backend_contract.py` — all 26 tests passing.

---

## Remaining Tasks (For Your Team)

### 1. Bootcamp Next Iteration (Immediate Scope - Toy Manufacturer Feedback)
* [ ] **Per-Doll Project Setup**: Shift frontend/backend focus from single fabric pieces to complete doll projects comprising multiple garments (e.g. jacket + pants + hat).
* [ ] **Multi-Fabric Sequence Support**: Generate combined engineering process workflows for multiple distinct fabric components within the same doll outfit.
* [ ] **Batch SMV Scaling**: Integrate SMV batching to multiply single-garment assembly times (SAM/SMV) into production run quantities (e.g., 100 to 1,000 pieces).
* [ ] **Operation Detail Expansion**: Add granular description fields for specific needle handling and presser foot actions in the sewing sequence.

### 3. Internship & Post-Bootcamp Roadmap (Experimental Scope)
* [ ] **3D Mannequin Preview (WebGL/WebGPU)**: Model a low-poly doll mannequin base mesh in Blender, optimize it via Meshopt and KTX2 compression, and load it dynamically in Next.js (via Three.js/React Three Fiber) to support real-time 2D fabric texture mapping overlays.
* [ ] **Post-Production Defect Inspection (YOLOv11)**: Deploy the custom-trained `apparel_defect_detector` YOLO model to flag factory-floor stitching defects.
* [ ] **Cross-Brand Portability**: Adapt the pattern recognition pipeline for other toy categories (e.g., die-cast toy decals alignment check).
