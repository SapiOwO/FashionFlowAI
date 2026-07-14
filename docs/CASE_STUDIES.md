---
title: "Case Study #5 & #6: FashionFlow MVP Refactoring"
date: "2026-07-14"
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
