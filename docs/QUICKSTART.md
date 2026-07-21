# Quickstart Guide

This guide walks you through setting up and running the FashionFlow AI application using your preferred installation pathway.

---

## 🚀 Choose Your Installation Pathway

### Option 1: Docker Compose (Recommended for Production & Local Evaluation)

*Best for users who want PostgreSQL with native `pgvector` HNSW vector search out of the box.*

```bash
# 1. Clone the repository
git clone https://github.com/SapiOwO/FashionFlowAI.git
cd FashionFlowAI

# 2. Launch App + PostgreSQL (pgvector) in detached mode
docker compose up --build -d
```
- **Frontend Dashboard**: `http://localhost:3000`
- **FastAPI Backend API**: `http://localhost:8000`
- **PostgreSQL Database**: `localhost:5432` (`DB_NAME=fashionflow_db`)

---

### Option 2: All-In-One Single Docker Container (Recommended for Cloud & VPS)

*Best for deploying to single-instance VPS servers (AWS EC2, DigitalOcean, Hetzner, GCP).*

```bash
# Pull stable release from GitHub Container Registry
docker run -d -p 3000:3000 -p 8000:8000 -v fashionflow-data:/app/data --name fashionflowai --restart always ghcr.io/sapiowo/fashionflowai:latest
```

---

### Option 3: Local Developer Setup (Python Virtualenv + Next.js)

*Best for active developers modifying FastAPI backend endpoints or Next.js frontend components.*

#### Prerequisites
* **Python 3.12.6** (Mandatory `.venv` virtual environment for AST parsing, PyTorch, and DINOv2 embeddings)
* **Node.js 18.x / 20.x** (Required for Next.js 16 frontend)

#### Setup Steps:
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
4. Install Frontend dependencies:
   ```bash
   cd frontend && npm install && cd ..
   ```
5. Launch both servers concurrently:
   ```bash
   python main.py
   ```

---

## 🧪 Running Automated Unit Tests

To run the full suite of **55 automated integration & contract tests** covering DINOv2 vector extraction, machine resolver logic, security headers middleware, work-aid tooling attachments, batch SMV scaling, and line balancing allocations:

```powershell
.\.venv\Scripts\pytest backend/tests/
```
*Result: 55 passed in ~12.5s (100% pass rate).*


