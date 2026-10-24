# Hướng dẫn triển khai — Trung Tâm Tri Thức AI (AI20K)

Hai cách: **Docker (chạy toàn bộ local/VPS)** và **Render (cloud, kết nối GitHub)**.

Thành phần ngoài (managed/cloud) dùng chung cho cả hai: **Qdrant Cloud** (vector),
**OpenAI** (LLM/embedding), **Cloudflare R2** (tài liệu gốc), **SMTP** (gửi OTP email).

---

## A. Docker — full stack local

`docker-compose.yml` dựng: PostgreSQL + Redis + Backend (FastAPI) + Worker (arq) + Frontend (nginx).

```bash
cp .env.example .env        # điền OPENAI_API_KEY, QDRANT_*, R2_*, EMAIL_* ...
docker compose up -d --build

# Khởi tạo dữ liệu mẫu (lần đầu)
docker compose exec backend python scripts/seed_demo.py
docker compose exec backend python scripts/seed_academic.py
# (tùy chọn) nạp tài liệu mẫu vào RAG
docker compose exec backend python scripts/ingest.py
```

- Frontend: <http://localhost:3000>
- Backend API + Swagger: <http://localhost:8000/docs>
- `DATABASE_URL` / `REDIS_URL` được compose tự trỏ vào service nội bộ (ghi đè `.env`).
- Tài khoản demo: `admin@ai20k.vn/admin123`, `lecturer@ai20k.vn/lecturer123`, `student@ai20k.vn/student123`.

Dừng: `docker compose down` (thêm `-v` để xóa cả dữ liệu Postgres/Redis).

> Build backend nặng do `docling`/`torch` (vài GB, vài phút lần đầu). Bình thường.

---

## B. Render — kết nối GitHub (Blueprint `render.yaml`)

1. Push repo lên GitHub.
2. Render → **New + → Blueprint** → chọn repo này. Render đọc `render.yaml` và tạo:
   - **ai20k-db** (PostgreSQL) · **ai20k-redis** (Key Value)
   - **ai20k-backend** (Web Service, Docker) · **ai20k-frontend** (Static Site)
3. Điền các biến bí mật (đánh dấu `sync: false`) trong nhóm **ai20k-shared** và service:
   - `OPENAI_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION_NAME`
   - `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT_URL`
   - `EMAIL_USERNAME`, `EMAIL_PASSWORD`, `EMAIL_FROM` (Gmail app password) — bỏ trống nếu chưa cần OTP
   - `DATABASE_URL`, `REDIS_URL` → Render tự nối từ db/redis (không cần điền tay)
4. Sau khi backend có domain (vd. `https://ai20k-backend.onrender.com`):
   - Đặt **frontend** env `VITE_API_URL` = URL backend, rồi **Manual Deploy** lại frontend (Vite nhúng URL lúc build).
   - Đặt **backend** env `CORS_ORIGINS` = URL frontend (vd. `https://ai20k-frontend.onrender.com`).
5. Khởi tạo dữ liệu: mở **Shell** của service backend trên Render rồi chạy
   `python scripts/seed_demo.py` (và `seed_academic.py`). Bảng được tạo tự động khi backend khởi động.

### Lưu ý quan trọng (Render)
- **RAM/Build**: `docling`+`torch` cần nhiều RAM. Plan **free (512MB)** dễ thiếu RAM khi xử lý
  tài liệu → khuyến nghị đổi backend sang **starter** (`plan: starter` trong `render.yaml`).
- **Worker**: mặc định `INGEST_ASYNC=false` (xử lý tài liệu ngay trong request, không cần worker).
  Khi muốn tách nền: đặt `INGEST_ASYNC=true` và bỏ comment service `ai20k-worker` (cần plan trả phí).
- Backend tự lắng nghe cổng `$PORT` do Render cấp; `/health` dùng cho health check.
- DB URL dạng `postgres://` của Render được chuẩn hóa tự động sang `asyncpg`.

---

## C. NGINX (tự host, không dùng container frontend)
Xem `deploy/nginx/ai20k.conf` + `deploy/README.md` (proxy `/api`, tắt buffering cho SSE chat,
`client_max_body_size 50m`).

## Checklist biến môi trường
| Biến | Bắt buộc | Ghi chú |
|------|----------|---------|
| `OPENAI_API_KEY` | ✅ | LLM + embedding |
| `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION_NAME` | ✅ | Vector store |
| `DATABASE_URL` | ✅ | Render/compose tự cấp |
| `JWT_SECRET_KEY` | ✅ | Render `generateValue`; local tự đặt |
| `R2_*` | ⬜ | Lưu tài liệu gốc (tắt → chỉ lưu local) |
| `REDIS_URL`, `INGEST_ASYNC` | ⬜ | Hàng đợi xử lý tài liệu nền |
| `EMAIL_*` | ⬜ | Gửi OTP quên mật khẩu (dev: log OTP) |
| `CORS_ORIGINS` | ✅ | URL frontend |
| `VITE_API_URL` (frontend) | ✅ | URL backend, nhúng lúc build |
