FROM python:3.11-slim

WORKDIR /app

# Install backend dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Install RAG dependencies
COPY rag/requirements.txt ./rag-requirements.txt
RUN pip install --no-cache-dir -r rag-requirements.txt

# Copy backend + RAG code
COPY backend/ ./backend/
COPY rag/ ./rag/

# Alembic config lives in backend/
WORKDIR /app/backend

# Ensure rag/ package is importable from /app
ENV PYTHONPATH="/app:${PYTHONPATH}"

# Create non-root user
RUN adduser --disabled-password --gecos '' appuser
USER appuser

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
