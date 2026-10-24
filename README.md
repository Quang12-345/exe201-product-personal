# C2-App-142 — Trung Tâm Tri Thức AI

Chatbot **RAG** hỏi đáp tài liệu học vụ của team C2-App-142 (AI20K Build Phase — Cohort 2). Hệ thống trả lời dựa trên đúng kho tài liệu của trường, **kèm trích dẫn nguồn và không bịa ngoài tài liệu**, dành cho **giảng viên** và **sinh viên**.

Kiến trúc gồm FastAPI backend, LangGraph agent, pipeline xử lý tài liệu (Docling / bộ trích xuất nhẹ), PostgreSQL + Qdrant, truy hồi hybrid (dense + BM25), xác thực JWT/RBAC, và giao diện React/Vite.

> Technical Guidebook: [phoenix.note.transformerlabs.ai/technical-book](https://phoenix.note.transformerlabs.ai/technical-book)

## Tính năng chính

- **RAG chatbot có trích dẫn nguồn**: hỏi đáp dựa trên tài liệu đã nạp, trả lời kèm tên tài liệu / trang / mục; từ chối câu hỏi ngoài phạm vi thay vì bịa.
- **Trải nghiệm chat hoàn chỉnh**: trả lời **streaming (gõ chữ) qua SSE**, render Markdown, **hỏi nối tiếp theo ngữ cảnh hội thoại** (query rewriting), và **đa ngôn ngữ** (ép ngôn ngữ trả lời khớp câu hỏi).
- **Truy hồi hybrid**: kết hợp dense embedding (Qdrant) + BM25, hợp nhất bằng RRF; có ngưỡng điểm tối thiểu chống trả lời bịa.
- **Pipeline dữ liệu tự động & idempotent**: convert PDF/DOCX/PPTX/TXT/MD → Markdown/JSON sạch → chunk (~900 token, overlap 120) → embed → Qdrant. Nhận diện tài liệu theo SHA-256 nên chạy lặp an toàn, tự dọn dữ liệu mồ côi.
- **Hai vai trò sản phẩm**: `lecturer` (tải lên & hỏi đáp tài liệu môn học) và `student` (hỏi đáp RAG, kho tài liệu, hạn mức chat). `admin` là tài khoản **vận hành/dev**: vào console là **toàn quyền** (mọi user, mọi tài liệu, analytics), không phải persona sản phẩm.
- **Phân quyền tài liệu (RBAC)**: tài liệu có scope `school` (chung) hoặc `personal` (riêng giảng viên) và phân loại `regulation` (quy chế) / `syllabus` (giáo trình). Filter truy hồi theo vai trò.
- **Xác thực linh hoạt**: đăng nhập bằng username/email + mật khẩu, **đăng nhập Gmail (Google OAuth)**, **quên mật khẩu bằng OTP email**, và luồng kích hoạt tài khoản được mời.
- **Lưu vết & dashboard realtime**: hội thoại, message, citation, agent run lưu DB; API `/conversations` + dashboard số liệu thật theo vai trò.
- **Hạ tầng vận hành**: Cloudflare R2 (lưu bản gốc tài liệu), Redis + arq (ingest nền), NGINX (reverse proxy + SSE), triển khai Docker / Render.

## Quick Start

### 1. Backend

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Bắt buộc: OPENAI_API_KEY, QDRANT_URL, QDRANT_API_KEY, DATABASE_URL.
# Deploy thật: đổi JWT_SECRET_KEY (python -c "import secrets; print(secrets.token_urlsafe(48))").

# Nạp tài liệu mẫu vào DB + Qdrant (chỉ cần chạy khi dataset thay đổi)
python scripts/ingest.py

# Tạo 3 tài khoản demo (admin/lecturer/student)
python scripts/seed_demo.py

uvicorn src.main:app --reload --port 8000
```

Swagger UI: `http://localhost:8000/docs`

> Phát triển nhanh không cần PostgreSQL: đặt `DATABASE_URL=sqlite+aiosqlite:///./data/app.db` trong `.env`.
>
> Bản cài nhẹ (không Docling/torch, dùng pypdf/python-docx/python-pptx): đặt `USE_DOCLING=false` — nhẹ RAM, hợp môi trường deploy giới hạn.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:8000
npm run dev
```

Frontend dev server: `http://localhost:5173`

### 3. Tài khoản demo (đăng nhập bằng **email** hoặc **username**)

| Vai trò  | Email               | Mật khẩu      |
| -------- | ------------------- | ------------- |
| Admin    | `admin@ai20k.vn`    | `admin123`    |
| Lecturer | `lecturer@ai20k.vn` | `lecturer123` |
| Student  | `student@ai20k.vn`  | `student123`  |

> Ô đăng nhập nhận **email hoặc username**. Tài khoản tạo qua `scripts/seed_demo.py`; tạo admin riêng bằng `python scripts/create_admin.py --email ... --password ... --name ...`.

## Luồng MVP End-to-End

```
Đăng nhập (JWT / Gmail)  →  Đặt câu hỏi  →  Lưu user message  →  Embed query
   →  Truy hồi hybrid (Qdrant + BM25)  →  LLM tổng hợp từ tài liệu (streaming)
   →  Trả lời + trích dẫn nguồn  →  Lưu hội thoại + citation
```

Đăng nhập theo vai trò sẽ điều hướng về trang tương ứng (`/admin`, `/lecturer`, `/student`). Sinh viên vào màn Chat hỏi đáp trực tiếp trên kho tài liệu đã nạp; hội thoại được lưu liền mạch và tự đặt tiêu đề.

## Cấu trúc Dự Án

```text
├── src/
│   ├── agents/                 # LangGraph: graph, state, nodes (validate→save→embed→retrieve→generate→persist)
│   ├── api/
│   │   ├── routes.py           # Khai báo route + RBAC
│   │   ├── dependencies.py     # get_current_user, require_roles (JWT)
│   │   └── controllers/        # Business logic theo domain: auth/user/chat/document/academic/conversation/stats
│   ├── core/security.py        # Hash mật khẩu (bcrypt) + phát hành/verify JWT
│   ├── db/                     # SQLAlchemy models + session + migration tự động (idempotent)
│   ├── models/                 # Pydantic schemas theo domain
│   ├── repositories/           # Data-access: user/document/conversation/student/exam/otp
│   ├── services/               # RAG: data_pipeline, chunking, embeddings, vector_store, retrieval (hybrid),
│   │                           #      llm, object_storage (R2), task_queue (arq), email_service
│   ├── worker.py               # arq worker xử lý ingest nền
│   ├── config.py               # Pydantic settings
│   └── main.py                 # App entry point + CORS + lifespan (init_db)
├── frontend/                   # React + Vite UI (feature-based)
│   └── src/
│       ├── features/{admin,lecturer,student,auth}/   # Màn hình theo vai trò
│       ├── services/           # axios client (gắn JWT, xử lý 401), chatStream (SSE), *Api services
│       ├── hooks/              # useChatConversations (hội thoại dùng chung)
│       └── constants/          # VITE_API_URL + ENDPOINTS
├── datasets/docs/              # Tài liệu nguồn PDF/DOCX/PPTX + questions.jsonl
├── data/processed/<doc-key>/   # Artifacts pipeline: raw.md, clean.md, docling.json, metadata.json, images/
├── eval/results/               # Kết quả đánh giá RAG (LLM-judge faithfulness/relevancy)
├── scripts/                    # ingest, seed_demo, create_admin, seed_academic, evaluate, AI logging hooks
├── migrations/                 # Alembic
├── tests/                      # Pytest (22 file test)
├── deploy/                     # NGINX config + hướng dẫn hạ tầng
├── docs/ · presentation/       # Guidebook, architecture, demo day
├── Dockerfile · frontend/Dockerfile · docker-compose.yml · render.yaml
└── JOURNAL.md · WORKLOG.md · ARCHITECTURE.md · DEPLOY.md
```

## Pipeline Dữ Liệu & Ingest

Dataset nguồn ở `datasets/docs/`; artifacts xử lý ở `data/processed/`; kết quả đánh giá ở `eval/results/`.

### Ingest tự động (idempotent — an toàn chạy lặp)

```bash
python scripts/ingest.py            # chỉ xử lý tài liệu mới/đổi; dọn points & document mồ côi
python scripts/ingest.py --force    # xử lý + embed lại toàn bộ
python scripts/ingest.py --reset    # xóa collection Qdrant rồi ingest lại từ đầu
```

Cơ chế ổn định cho triển khai:

- Tài liệu nhận diện theo **SHA-256** — file không đổi sẽ bỏ qua (không tốn phí embedding).
- File bị xóa khỏi `datasets/docs/` → tự dọn document trong DB + points tương ứng trên Qdrant.
- Mất dữ liệu vector store → tự embed lại ở lần ingest sau.
- Cũng gọi được qua API: `POST /api/v1/datasets/rag-sample/ingest?force=true` (admin/lecturer).
- Giảng viên/Admin có thể **upload tài liệu qua UI** (`POST /api/v1/documents/upload`); ingest có thể chạy **nền qua Redis/arq** khi bật `INGEST_ASYNC=true`.

### Chỉ xử lý dữ liệu (không ingest)

```bash
python -m src.services.data_pipeline              # convert + clean + chunk → data/processed/
python -m src.services.data_pipeline --no-cache   # ép chạy lại bộ chuyển đổi
```

### Đánh giá (Evaluation)

Cần `datasets/docs/questions.jsonl`. Output ở `eval/results/`. Eval harness dùng **LLM-judge** đo faithfulness & relevancy.

```bash
python scripts/evaluate_rag_sample.py
```

Kết quả gần nhất (bộ 10 câu hỏi): **faithfulness 0.94 · relevancy 0.88**; trả lời đúng phạm vi và từ chối câu ngoài phạm vi.

## API Chính

Mọi endpoint nghiệp vụ dùng prefix `/api/v1`. Endpoint cần token gửi header `Authorization: Bearer <token>`. Danh sách rút gọn — xem đầy đủ tại Swagger `http://localhost:8000/docs`.

### Auth

| Method | Endpoint                       | Quyền     | Mục đích                            |
| ------ | ------------------------------ | --------- | ----------------------------------- |
| `POST` | `/api/v1/auth/login`           | Công khai | Đăng nhập (username/email) → JWT     |
| `POST` | `/api/v1/auth/gmail-login`     | Công khai | Đăng nhập bằng Google ID token       |
| `POST` | `/api/v1/auth/forgot-password` | Công khai | Gửi OTP khôi phục mật khẩu (email)   |
| `POST` | `/api/v1/auth/verify-otp`      | Công khai | Xác minh OTP                         |
| `POST` | `/api/v1/auth/reset-password`  | Công khai | Đặt lại mật khẩu                     |

### Chat & Hội thoại

| Method   | Endpoint                              | Quyền            | Mục đích                       |
| -------- | ------------------------------------- | ---------------- | ------------------------------ |
| `POST`   | `/api/v1/chat`                        | Đã đăng nhập     | Hỏi đáp RAG (đồng bộ, có nguồn) |
| `POST`   | `/api/v1/chat/stream`                 | Đã đăng nhập     | Hỏi đáp RAG streaming (SSE)     |
| `GET`    | `/api/v1/conversations`               | Đã đăng nhập     | Danh sách hội thoại            |
| `GET`    | `/api/v1/conversations/{id}/messages` | Chủ sở hữu/admin | Lịch sử tin nhắn                |
| `PUT`    | `/api/v1/conversations/{id}`          | Chủ sở hữu/admin | Đổi tên hội thoại              |
| `DELETE` | `/api/v1/conversations/{id}`          | Chủ sở hữu/admin | Xóa hội thoại                  |

### Tài liệu

| Method           | Endpoint                          | Quyền           | Mục đích                            |
| ---------------- | --------------------------------- | --------------- | ----------------------------------- |
| `POST`           | `/api/v1/documents/upload`        | admin, lecturer | Tải lên & ingest tài liệu           |
| `GET`            | `/api/v1/documents/mine`          | admin, lecturer | Tài liệu của tôi                    |
| `GET`            | `/api/v1/documents/available`     | Đã đăng nhập    | Tài liệu được phép xem theo vai trò |
| `GET`            | `/api/v1/documents/{id}/view`     | Đã đăng nhập    | Xem trước nội dung                  |
| `GET`            | `/api/v1/documents/{id}/download` | admin, lecturer | Tải bản gốc (presigned URL từ R2)   |
| `PUT` / `DELETE` | `/api/v1/documents/{id}`          | admin, lecturer | Cập nhật / xóa tài liệu             |

### Học vụ · Quản trị · Hệ thống

| Method                       | Endpoint                              | Quyền           | Mục đích                       |
| ---------------------------- | ------------------------------------- | --------------- | ------------------------------ |
| `GET`/`POST`/`PUT`/`DELETE`  | `/api/v1/students`                    | admin, lecturer | CRUD sinh viên                 |
| `GET`/`POST`/`PUT`/`DELETE`  | `/api/v1/exams`                       | admin, lecturer | CRUD lịch thi                  |
| `GET`                        | `/api/v1/stats/overview`              | Đã đăng nhập    | Số liệu dashboard theo vai trò |
| `GET` / `POST`               | `/api/v1/users` · `/create-user`      | admin           | Quản lý người dùng             |
| `PUT`                        | `/api/v1/users/me`                    | Đã đăng nhập    | Cập nhật hồ sơ bản thân        |
| `GET`                        | `/api/v1/diagnostics`                 | admin           | Kiểm tra Qdrant/OpenAI/DB       |
| `GET`                        | `/api/v1/status` · `/health`          | Công khai       | Trạng thái agent / health check |

## Frontend

Giao diện React + Vite, tổ chức theo feature, **đã nối backend thật** ở toàn bộ luồng chính:

- **Auth**: login (username/email), đăng nhập Gmail, quên mật khẩu OTP đa bước, protected routes — JWT thật.
- **Student**: chat RAG streaming + hiển thị nguồn, lịch sử hội thoại, kho tài liệu (chỉ báo tài liệu mới), câu trả lời đã lưu, settings.
- **Lecturer**: dashboard realtime, chat, quản lý tài liệu môn học, settings.
- **Admin (vận hành/dev)**: console toàn quyền — mọi tài khoản, mọi tài liệu, analytics. Không onboarding, không phải người dùng sản phẩm.

Tầng tích hợp tập trung ở `frontend/src/services/api.js` (axios + interceptor gắn JWT, xử lý 401), `frontend/src/services/chatStream.js` (SSE + tự fallback POST khi stream lỗi), hook dùng chung `useChatConversations`, và `frontend/src/constants/index.js` (ENDPOINTS, `VITE_API_URL`).

## Testing

```bash
python -m pytest
```

Bao phủ (22 file test, ~128 ca): agent graph + nodes (soft-fail), API routes + auth/RBAC, Gmail login, OTP reset, documents, academic (students/exams), users, config, DB models, chunking, document parser, vector store, data pipeline, object storage, ingest script.

> Nếu gặp `ModuleNotFoundError: No module named 'jose'` khi chạy test: cài đúng package `pip install "python-jose[cryptography]"` (không phải `jose`).

## Tech Stack

| Layer            | Technology                                                         |
| ---------------- | ------------------------------------------------------------------ |
| Agent            | LangGraph + LangChain                                              |
| LLM              | OpenAI GPT-4o-mini                                                 |
| Embedding        | OpenAI `text-embedding-3-small` (1536 chiều)                       |
| Retrieval        | Hybrid: dense (Qdrant) + BM25, hợp nhất bằng RRF                   |
| Document parsing | Docling / lightweight pypdf·python-docx·python-pptx (`USE_DOCLING`) |
| Vector Store     | Qdrant (Cloud)                                                     |
| Backend          | FastAPI + SQLAlchemy (async)                                       |
| Auth             | JWT (python-jose) + bcrypt · Google OAuth · OTP email (SMTP/Brevo) |
| Queue / Storage  | Redis + arq · Cloudflare R2                                        |
| Database         | PostgreSQL (prod) / SQLite (dev)                                   |
| Frontend         | React + Vite + axios                                               |
| DevOps           | Docker + docker-compose · NGINX · Render (Blueprint)              |
| Testing          | pytest + pytest-asyncio                                            |

## Triển Khai (Deploy)

Xem chi tiết tại [DEPLOY.md](DEPLOY.md) (Docker, Render Blueprint, NGINX, checklist env).

- **Docker**: `docker-compose up` chạy full stack (Postgres + Redis + backend + worker + frontend).
- **Render**: dùng `render.yaml` (Blueprint) — backend (Docker) + frontend (static) + Postgres + Redis. Đặt `SEED_DEMO=true` để tự seed tài khoản khi không có shell; `USE_DOCLING=false` để tránh OOM trên gói RAM thấp; gửi OTP qua **Brevo HTTP API** (`BREVO_API_KEY`) vì Render chặn cổng SMTP.
- Frontend đọc backend qua `VITE_API_URL` (nhúng lúc build); backend cấu hình `CORS_ORIGINS` = URL frontend.

## AI Logging Hooks

```bash
bash scripts/setup_hooks.sh                                   # Linux / macOS / Git Bash
# powershell -ExecutionPolicy Bypass -File scripts\setup_hooks.ps1   # Windows
```

Hooks tự động log prompt/tool call khi dùng Claude Code, Cursor, Codex, Gemini CLI, Antigravity hoặc GitHub Copilot. Với ChatGPT/web tool khác:

```bash
bash scripts/_pyrun.sh scripts/log_manual.py --tool chatgpt --prompt "What you asked"
```

## Deliverables

| #   | Deliverable          | Vị trí                                |
| --- | -------------------- | ------------------------------------- |
| 1   | Source Code          | `src/`, `frontend/`                   |
| 2   | README               | `README.md` · `README_boilerplate.md` |
| 3   | Architecture Diagram | `ARCHITECTURE.md`, `Architecture.png` |
| 4   | AI Logs              | `.ai-log/`, hooks ở `scripts/`        |
| 5   | Live URL             | Render (backend + frontend)           |
| 6   | Video Demo           | `presentation/`                       |
| 7   | Pitch Deck           | `presentation/`                       |
| 8   | Development Journal  | `JOURNAL.md`                          |
| 9   | Worklog              | `WORKLOG.md`                          |
| 10  | Evaluation Evidence  | `eval/results/`                       |

## Team

| Member           | Role                                              |
| ---------------- | ------------------------------------------------- |
| Hoàng Văn Anh    | AI/Backend Lead — RAG agent, pipeline, DB, deploy |
| Nguyễn Thành Lộc | Frontend — UI/UX, tích hợp API, streaming chat    |
| Phạm Tuyết Nga   | Project Management — charter, QA, tài liệu, demo  |

## Liên Kết

- Technical Guidebook: [phoenix.note.transformerlabs.ai/technical-book](https://phoenix.note.transformerlabs.ai/technical-book)
- AI20K Program: VinUni AI20K Build Phase — Cohort 2

## License

MIT — Sử dụng tự do cho mục đích giáo dục.
