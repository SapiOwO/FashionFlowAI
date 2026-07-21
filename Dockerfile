# FashionFlow AI - All-In-One Production Container
# Packages Python FastAPI Backend + Next.js Frontend + Embedded PostgreSQL/pgvector into 1 Container

# Stage 1: Build Next.js Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
ENV NEXT_PUBLIC_API_URL=http://localhost:8000
RUN npm run build

# Stage 2: Final All-In-One Container (Python 3.12 + Node.js 20 + PostgreSQL + pgvector)
FROM python:3.12-slim

# Install Node.js, OpenCV, PostgreSQL, and build pgvector extension from source
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    build-essential \
    postgresql-server-dev-all \
    libgl1 \
    libglib2.0-0 \
    postgresql \
    postgresql-contrib \
    && cd /tmp && git clone --branch v0.7.4 https://github.com/pgvector/pgvector.git \
    && cd pgvector && make && make install \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/pgvector

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

# Expose ports (3000: Next.js Web UI, 8000: FastAPI Backend, 5432: PostgreSQL)
EXPOSE 3000 8000 5432

ENV IS_DOCKER=true
ENV DB_TYPE=postgresql
ENV DB_HOST=127.0.0.1
ENV DB_PORT=5432
ENV DB_USER=postgres
ENV DB_PASSWORD=postgres
ENV DB_NAME=fashionflow_db

# Launch servers and postgres service via unified main.py launcher
CMD ["python", "main.py"]
