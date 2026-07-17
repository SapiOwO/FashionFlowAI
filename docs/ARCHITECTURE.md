# System Architecture

This document describes the structural design, system boundaries, and database metastores of the FashionFlow AI application.

## System Boundaries

The application is decoupled into an independent frontend web client and a Python AI + database microservice:

```mermaid
graph TD
    User([User Browser]) -->|Next.js UI| NextJS[Next.js Frontend - port 3000]
    NextJS -->|API Requests: /predict, /search, /history| FastAPI[FastAPI Backend - port 8000]
    FastAPI -->|Dynamic Inference| ModelsDir[(models/ folder)]
    FastAPI -->|Dual Database Metastore| DB[(PostgreSQL + pgvector / SQLite)]
    DB -->|Sewing Machine CSVs| CSVs[(data/ Juki Catalogs)]
```

### 1. Frontend Web Client (Next.js Node Server)
* Serves the collapsible Codinglab dashboard UI (Design Input, Sewing Sequence, Tooling Recommendations, etc.).
* Collects garment sketch uploads, image files, and version selections from the user.
* Sends API requests to the FastAPI backend and renders structured process sheets dynamically (coordinates overlays, step-by-step tables with matching part icons, and estimated SMVs).

### 2. Python AI & Database Microservice (FastAPI Uvicorn Service)
* Runs independently on port `8000`.
* **AI Engine**: Loads YOLOv11 and PyTorch/MobileNetV3 model weights from the `models/` folder dynamically based on user selections.
* **Database Metastore (`backend/db.py`)**: 
  * Automatically handles schema creation and database seeding.
  * Manages dual modes: SQLite (with numpy-based local vector search) or PostgreSQL (with native pgvector HNSW cosine searches).
  * Stores persistent analysis logs in the `analysis_history` table so that upload history is saved across server restarts.
  * Reads the Juki machinery catalogs (`data/juki_master_catalog.csv`) to seed the historical knowledge database and serve machine specs details on startup.

### 3. WebGL/WebGPU 3D Asset Pipeline (Planned)
* **Mannequin Base Mesh (Blender Preset)**: A low-poly mannequin model representing the doll torso, exported as a `.glb` binary asset and optimized via Meshopt/KTX2 Basis compression.
* **Garment Meshes (Blender Presets)**: Standard garment types (Shirt, T-Shirt, Jacket, Pants, Skirt) modeled to fit the mannequin's dimensions, loaded/unloaded in React Three Fiber dynamically.
* **Dynamic Texture Mapping**: 2D fabric prints/motifs uploaded by artists/designers are processed as standard canvas textures and mapped in real-time onto the active 3D garment mesh material (UV coordinates). This provides instant visual alignment for designers and operators without expensive CPU/GPU cloth physics simulations.

