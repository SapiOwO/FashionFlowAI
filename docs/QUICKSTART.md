# Quickstart Guide

This guide walks you through setting up and running the FashionFlow decoupled application locally.

## Prerequisites

* **Node.js** (v18 or higher)
* **Python** (v3.10 or higher - required for Microsoft MarkItDown and AST parsing)
* **PostgreSQL** (Optional - with `pgvector` extension if using Postgres mode; otherwise defaults to SQLite)

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
