# ---- Stage 1: Build dependencies ----
FROM python:3.11-slim AS builder

WORKDIR /app

# Thư viện hệ thống cần cho build một số package (vd. docling/pillow/pytesseract).
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ---- Stage 2: Runtime ----
FROM python:3.11-slim

WORKDIR /app

# Runtime libs nhẹ (tesseract cho OCR ảnh trong tài liệu — bỏ nếu không cần).
RUN apt-get update && apt-get install -y --no-install-recommends \
        tesseract-ocr \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m appuser

# Copy gói Python đã cài (gán quyền cho appuser để chạy non-root).
COPY --from=builder --chown=appuser:appuser /root/.local /home/appuser/.local
ENV PATH=/home/appuser/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# Copy mã nguồn ứng dụng.
COPY --chown=appuser:appuser . .
RUN mkdir -p /app/data /app/datasets/uploads && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# Render/host truyền PORT; mặc định 8000 khi chạy local.
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD python -c "import os,urllib.request; urllib.request.urlopen(f\"http://localhost:{os.getenv('PORT','8000')}/health\")" || exit 1

CMD ["sh", "-c", "uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
