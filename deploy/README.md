# Hạ tầng triển khai — AI20K

Ba thành phần hạ tầng bổ sung: **Cloudflare R2** (object store), **Redis + arq**
(message queue), **NGINX** (reverse proxy).

```
Người dùng ──► NGINX :80 ──┬─► /         → frontend/dist (SPA tĩnh)
                           ├─► /api/      → FastAPI :8000
                           └─► /health    → FastAPI :8000

FastAPI ──► PostgreSQL (metadata) + Qdrant (vector)
        ──► Cloudflare R2 (tài liệu gốc)
        ──► Redis ──► arq worker (docling + embedding nền)
```

## 1. Cloudflare R2 (lưu tài liệu gốc)

Cấu hình trong `.env`:

```
OBJECT_STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=...
R2_BUCKET_NAME=ai-knowledge-hub-prod
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com
R2_REGION=auto
```

- Khi `OBJECT_STORAGE_PROVIDER=local` (mặc định), mọi thao tác R2 là no-op — app vẫn chạy.
- Mỗi tài liệu upload sẽ được đẩy bản gốc lên R2 với key `documents/<owner_id>/<file>`;
  key lưu trong `metadata_json.r2_key`. Xóa tài liệu sẽ xóa luôn object trên R2.
- Tải bản gốc: `GET /api/v1/documents/{id}/download` → trả URL presigned (1 giờ).

## 2. Redis + arq (message queue xử lý tài liệu)

Redis chưa cài sẵn trên máy → chạy bằng Docker:

```bash
docker compose -f deploy/docker-compose.yml up -d      # khởi động Redis
docker compose -f deploy/docker-compose.yml ps         # kiểm tra (healthy)
```

Bật chế độ hàng đợi và khởi động worker:

```bash
# .env
INGEST_ASYNC=true
REDIS_URL=redis://localhost:6379/0

# Terminal riêng (đã activate conda env venv):
python -m src.worker
```

Khi `INGEST_ASYNC=true`:
- Upload tài liệu → tạo bản ghi trạng thái `queued` + đẩy job vào Redis → trả về NGAY.
- Worker arq nhận job, chạy docling + embedding + upsert Qdrant → cập nhật `ready`/`failed`.
- Nếu Redis không kết nối được, endpoint tự động fallback sang xử lý inline (không lỗi).

Khi `INGEST_ASYNC=false` (mặc định): xử lý ngay trong request (không cần worker/Redis).

## 3. NGINX (reverse proxy)

```bash
cd frontend && npm run build && cd ..                   # build SPA -> frontend/dist
sudo cp deploy/nginx/ai20k.conf /etc/nginx/sites-available/ai20k.conf
sudo ln -sf /etc/nginx/sites-available/ai20k.conf /etc/nginx/sites-enabled/ai20k.conf
sudo nginx -t && sudo systemctl reload nginx
```

- `client_max_body_size 50m` cho upload tài liệu.
- `/api/v1/chat/stream` tắt buffering để stream SSE mượt.
- Mọi route SPA fallback về `index.html`.

## Thứ tự khởi động đầy đủ (production-like)

```bash
docker compose -f deploy/docker-compose.yml up -d       # Redis
python scripts/seed_demo.py && python scripts/seed_academic.py
uvicorn src.main:app --host 0.0.0.0 --port 8000         # backend
python -m src.worker                                    # worker (nếu INGEST_ASYNC=true)
sudo systemctl reload nginx                              # reverse proxy
```
