# FashionFlow AI - All-In-One Production Container
# Packages Python FastAPI Backend + Next.js Frontend into 1 Single Container

# Stage 1: Build Next.js Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
ENV NEXT_PUBLIC_API_URL=http://localhost:8000
RUN npm run build

# Stage 2: Final All-In-One Container (Python 3.12 + Node.js 20 Runtime)
FROM python:3.12-slim

# Install Node.js & OpenCV system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    libgl1 \
    libglib2.0-0 \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application backend & asset data
COPY backend/ ./backend
COPY data/ ./data
COPY models/ ./models
COPY main.py ./

# Copy compiled Next.js build & node_modules from builder
COPY --from=frontend-builder /app/frontend ./frontend

# Expose ports (3000: Next.js Web UI, 8000: FastAPI Backend)
EXPOSE 3000 8000

ENV IS_DOCKER=true

# Launch both servers via unified main.py launcher
CMD ["python", "main.py"]
