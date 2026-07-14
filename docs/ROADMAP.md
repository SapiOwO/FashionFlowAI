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

---

## Remaining Tasks (For Your Team)

* [ ] **Docker Containers**
  * Configure multi-container Dockerfile and Docker Compose settings for production deployments.
