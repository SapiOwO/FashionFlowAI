# Quickstart Guide

This guide walks you through setting up and running the FashionFlow decoupled application locally.

## Prerequisites

* **Python 3.12.6** (Mandatory `.venv` virtual environment for AST parsing, PyTorch, and DINOv2 embeddings)
* **Node.js 18.x / 20.x** (Required for Next.js 16 frontend)
* **PostgreSQL** (Optional - with `pgvector` extension for production HNSW search; defaults to SQLite for local dev)

---

## 1. Setup & Installation

### A. Python Backend (Virtual Environment)
1. In the project root, create a Python virtual environment:
   ```bash
   python -m venv .venv
   ```
2. Activate the virtual environment:
   * **Windows (PowerShell)**:
     ```powershell
     .venv\Scripts\Activate.ps1
     ```
   * **macOS / Linux**:
     ```bash
     source .venv/bin/activate
     ```
3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Place your Google Colab model weight files (such as `best.pt`, `mobilenet_textiles.pth` or `.h5` files) into the `models/` directory.

### B. Next.js Frontend
1. Navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install the Node.js packages:
   ```bash
   npm install
   ```
3. Return to the root folder:
   ```bash
   cd ..
   ```

---

## 2. Database Modes & Configuration

Copy the example environment template `.env.example` at the root folder to `.env`:

```env
DB_TYPE=sqlite
```

### Option A: SQLite (Default)
* Under SQLite mode (`DB_TYPE=sqlite`), the backend automatically creates `fashionflow.db` locally. No additional installations are required.

### Option B: PostgreSQL (with pgvector)
* Change `DB_TYPE` to `postgres` and configure credentials (`DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`).
* Ensure `pgvector` is installed. The backend will automatically create the database and compile HNSW indexes on startup.

---

## 3. Importing JUKI Machine Catalogs & Data Seeding

1. To load Juki sewing machines knowledge, make sure your PDF catalogs are in the `data/` directory and run the cleanup pipeline:
   ```bash
   # Already run in current setup to output clean CSVs
   ```
2. To load your historical garment process sheets into the database:
   * Place your CSV data file at `data/historical_products.csv`.
   * Run the importer tool:
     ```bash
     python import_csv.py
     ```

---

## 4. Running Both Servers Concurrently

To start both the FastAPI backend (port 8000) and the Next.js frontend (port 3000) concurrently with unified logging and clean Ctrl+C exits, run:
```bash
python main.py
```

Press `Ctrl+C` in the terminal to stop both servers at the same time.

---

## 5. Running Automated Contract Unit Tests

To run the full suite of **40 automated integration & contract tests** covering DINOv2 vector extraction, machine resolver logic, work-aid tooling attachments, batch SMV scaling, and line balancing allocations:

```powershell
.venv\Scripts\python.exe -m unittest backend/tests/test_backend_contract.py
```


