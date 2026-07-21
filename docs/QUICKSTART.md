# Quickstart & Installation Guide 🚀

This guide walks you through setting up and running FashionFlow AI using Docker, Python virtual environment, or Docker Compose.

---

## Quick Start with Docker 🐳

> [!WARNING]
> When using Docker to install FashionFlow AI, make sure to include `-v fashionflow-data:/app/data` in your Docker command. This step is crucial as it ensures your PostgreSQL database and uploaded garment sketches are properly mounted and prevents any loss of data across container updates.

### Installation with Default Configuration

Run this command in your terminal to start FashionFlow AI:

```bash
docker run -d -p 3000:3000 -p 8000:8000 -v fashionflow-data:/app/data --name fashionflowai --restart always ghcr.io/sapiowo/fashionflowai:latest
```

After installation, access the FashionFlow AI Engineering Dashboard at **http://localhost:3000**. Enjoy! 🎉

---

## Using the Dev Branch 🌙

> [!WARNING]
> The `:dev` branch contains the latest unstable features and changes. Use it at your own risk as it may have minor bugs or incomplete features.

If you want to try out the latest bleeding-edge features, you can use the `:dev` tag:

```bash
docker run -d -p 3000:3000 -p 8000:8000 -v fashionflow-data:/app/data --name fashionflowai-dev --restart always ghcr.io/sapiowo/fashionflowai:dev
```

---

## Keeping Your Docker Installation Up-to-Date 🔄

How to update FashionFlow AI without losing your saved projects or database data:

1. **Pull the latest image**:
   ```bash
   docker pull ghcr.io/sapiowo/fashionflowai:latest
   ```

2. **Stop the current container**:
   ```bash
   docker stop fashionflowai
   ```

3. **Remove the old container**:
   ```bash
   docker rm fashionflowai
   ```

4. **Start the updated container**:
   ```bash
   docker run -d -p 3000:3000 -p 8000:8000 -v fashionflow-data:/app/data --name fashionflowai --restart always ghcr.io/sapiowo/fashionflowai:latest
   ```

---

## Installation via Python & Local Environment 🐍

For active developers modifying backend FastAPI code or Next.js components:

1. **Clone repository**:
   ```bash
   git clone https://github.com/SapiOwO/FashionFlowAI.git
   cd FashionFlowAI
   ```

2. **Create & activate Python 3.12 virtual environment**:
   ```powershell
   python -m venv .venv
   .venv\Scripts\Activate.ps1   # Windows PowerShell
   # source .venv/bin/activate  # macOS / Linux
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   cd frontend && npm install && cd ..
   ```

4. **Launch development environment**:
   ```bash
   python main.py
   ```

---

## Other Installation Methods 📦

* **Multi-Container Docker Compose (with Dedicated Standalone Postgres Container)**:
  ```bash
  git clone https://github.com/SapiOwO/FashionFlowAI.git
  cd FashionFlowAI
  docker compose up --build -d
  ```

---

## 🧪 Running Automated Unit Tests

To run the full suite of **55 automated integration & contract tests** covering DINOv2 vector extraction, machine resolver logic, security headers middleware, work-aid tooling attachments, batch SMV scaling, and line balancing allocations:

```powershell
.\.venv\Scripts\pytest backend/tests/
```
*Result: 55 passed in ~12.5s (100% pass rate).*


