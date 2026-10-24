# Trung Tâm Tri Thức AI — C2-App-142

> Tóm tắt 1 câu: Sinh viên & giảng viên mất quá nhiều thời gian tra cứu quy chế, giáo trình, tài liệu môn học → **Chatbot RAG hỏi đáp tài liệu, trả lời kèm trích dẫn nguồn, không bịa ngoài tài liệu** dành cho cộng đồng học tập (admin / giảng viên / sinh viên).

---

## Vấn đề (Problem)

Tài liệu học vụ (quy chế, quy định, giáo trình, syllabus, slide bài giảng) nằm rải rác ở nhiều định dạng (PDF/DOCX/PPTX), nhiều nơi lưu trữ và rất khó tra cứu nhanh.

- **Ai đang gặp vấn đề?** Sinh viên cần tra quy chế/giáo trình; giảng viên cần phân phát tài liệu môn học và quản lý học vụ; phòng đào tạo/quản trị cần kiểm soát nội dung được phép truy cập.
- **Vấn đề tốn bao nhiêu thời gian?** Một câu hỏi đơn giản ("điều kiện thi lại?", "quy định điểm danh?") có thể tốn 10–30 phút lục tài liệu PDF dài hàng chục trang; câu trả lời từ tìm kiếm thông thường thường thiếu ngữ cảnh hoặc không chỉ ra được nguồn.
- **Tại sao giải pháp hiện tại chưa đủ?** Tìm kiếm từ khóa không hiểu ngữ nghĩa; còn chatbot LLM thuần thì **bịa (hallucinate)** và không trích dẫn được nguồn nên không thể tin để dùng cho thông tin học vụ. Cũng chưa có cơ chế **phân quyền tài liệu** (tài liệu nội bộ của giảng viên không nên lộ cho mọi sinh viên).

## Giải pháp (Solution)

Một hệ thống **RAG (Retrieval-Augmented Generation)** hỏi đáp trên đúng kho tài liệu của trường, có phân quyền theo vai trò và luôn dẫn nguồn:

- **Chatbot RAG có trích dẫn nguồn**: trả lời dựa trên tài liệu đã nạp, kèm tên tài liệu / trang / mục; từ chối câu hỏi ngoài phạm vi thay vì bịa. Hỗ trợ **trả lời streaming (gõ chữ)**, **hỏi nối tiếp theo ngữ cảnh hội thoại** và **đa ngôn ngữ** (ép ngôn ngữ trả lời khớp câu hỏi).
- **Pipeline dữ liệu tự động & idempotent**: convert PDF/DOCX/PPTX → Markdown/JSON sạch → chunk (~900 token, overlap 120) → embed → Qdrant; nhận diện tài liệu theo SHA-256 nên chạy lặp an toàn, tự dọn dữ liệu mồ côi.
- **Phân quyền tài liệu (RBAC) & học vụ**: 3 vai trò `admin` / `lecturer` / `student`; tài liệu có scope `school` (chung) hoặc `personal` (riêng giảng viên); giảng viên quản; admin phân loại tài liệu (quy chế / giáo trình).
- **Lưu vết & dashboard realtime**: hội thoại, message, citation, agent run lưu DB; dashboard số liệu thật theo vai trò.
- **Xác thực linh hoạt**: đăng nhập bằng username/email + mật khẩu, **đăng nhập Gmail (Google OAuth)**, và **quên mật khẩu bằng OTP email**.

## Target User

- **Primary**:
  - *Sinh viên* — hỏi đáp nhanh quy chế, giáo trình, tài liệu môn học và nhận câu trả lời có nguồn.
  - *Giảng viên* — tải lên & quản lý tài liệu môn học, quản lý danh sách sinh viên và lịch thi.
- **Secondary**:
  - *Quản trị viên / phòng đào tạo* — quản lý người dùng, phân loại & kiểm soát tài liệu chung, theo dõi số liệu sử dụng.

## Tech Stack

| Layer            | Technology                                                                       |
| ---------------- | -------------------------------------------------------------------------------- |
| AI Agent         | LangGraph + LangChain                                                            |
| LLM              | OpenAI GPT-4o-mini                                                               |
| Embedding        | OpenAI`text-embedding-3-small` (1536 chiều)                                   |
| Retrieval        | Hybrid: dense (Qdrant) + BM25, hợp nhất bằng RRF                              |
| Document parsing | Docling (đầy đủ) / lightweight pypdf·python-docx·python-pptx (deploy nhẹ) |
| Vector Store     | Qdrant (Cloud)                                                                   |
| Backend          | FastAPI + SQLAlchemy async, Python 3.11+                                         |
| Auth             | JWT (python-jose) + bcrypt · Google OAuth · OTP email                          |
| Queue / Storage  | Redis + arq (ingest nền) · Cloudflare R2 (object store)                        |
| Frontend         | React + Vite + axios (feature-based)                                             |
| Database         | PostgreSQL (prod) / SQLite (dev)                                                 |
| DevOps           | Docker + docker-compose · NGINX · Render (Blueprint)                           |
| Testing          | pytest + pytest-asyncio (128 tests)                                              |

## Quick Start

```bash
# 1. Clone repo
git clone https://github.com/AI20K-Build-Cohort-2/C2-App-142.git
cd C2-App-142

# 2. Backend: môi trường & cấu hình
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Bắt buộc: OPENAI_API_KEY, QDRANT_URL, QDRANT_API_KEY, DATABASE_URL
# Deploy thật: đổi JWT_SECRET_KEY
#   python -c "import secrets; print(secrets.token_urlsafe(48))"
# Dev nhanh không cần Postgres: DATABASE_URL=sqlite+aiosqlite:///./data/app.db

# 3. Nạp tài liệu mẫu + tạo tài khoản demo
python scripts/ingest.py            # ingest idempotent vào DB + Qdrant
python scripts/seed_demo.py         # 3 tài khoản admin/lecturer/student

# 4. Chạy backend
uvicorn src.main:app --reload --port 8000      # Swagger: http://localhost:8000/docs

# 5. Frontend (terminal khác)
cd frontend
npm install
cp .env.example .env                # VITE_API_URL=http://localhost:8000
npm run dev                         # http://localhost:5173
```

### Tài khoản demo (đăng nhập bằng **email** hoặc **username**)

| Vai trò | Email                 | Mật khẩu      |
| -------- | --------------------- | --------------- |
| Admin    | `admin@ai20k.vn`    | `admin123`    |
| Lecturer | `lecturer@ai20k.vn` | `lecturer123` |
| Student  | `student@ai20k.vn`  | `student123`  |

## Project Structure

```text
├── src/
│   ├── agents/              # LangGraph: graph + state + nodes
│   │   ├── graph.py         # validate → save msg → embed → retrieve → generate → persist
│   │   ├── state.py         # State schema (query, user_role, context, answer, sources)
│   │   └── nodes/           # Từng node (soft-fail để không kẹt agent run)
│   ├── api/
│   │   ├── routes.py        # Khai báo route + RBAC
│   │   ├── dependencies.py  # get_current_user, require_roles (JWT)
│   │   └── controllers/     # Business logic theo domain: auth/user/chat/document/...
│   ├── core/security.py     # bcrypt hash + phát hành/verify JWT
│   ├── db/                  # SQLAlchemy models + session + migration tự động
│   ├── models/              # Pydantic schemas theo domain
│   ├── repositories/        # Data-access: user/document/conversation/student/exam
│   ├── services/            # RAG: data_pipeline, chunking, embeddings, vector_store,
│   │                        #      retrieval (hybrid), llm, object_storage, task_queue, email
│   ├── worker.py            # arq worker xử lý ingest nền
│   ├── config.py            # Pydantic settings
│   └── main.py              # App entry point + CORS + lifespan (init_db)
├── frontend/                # React + Vite (feature-based)
│   └── src/
│       ├── features/{admin,lecturer,student,auth}/   # Màn hình theo vai trò
│       ├── services/        # axios client (gắn JWT, xử lý 401), chatStream (SSE), API services
│       ├── hooks/           # useChatConversations (hội thoại dùng chung)
│       └── constants/       # VITE_API_URL + ENDPOINTS
├── datasets/docs/           # Tài liệu nguồn PDF/DOCX/PPTX + questions.jsonl
├── data/processed/          # Artifacts pipeline: raw.md, clean.md, docling.json, metadata.json
├── eval/results/            # Kết quả đánh giá RAG (LLM-judge faithfulness/relevancy)
├── scripts/                 # ingest, seed_demo, create_admin, evaluate, AI logging hooks
├── migrations/              # Alembic
├── tests/                   # Pytest (128 tests)
├── deploy/ · docs/ · presentation/   # NGINX, guidebook, architecture, demo
├── Dockerfile · frontend/Dockerfile · docker-compose.yml · render.yaml
└── JOURNAL.md · WORKLOG.md · ARCHITECTURE.md · DEPLOY.md
```

## API Endpoints

Mọi endpoint nghiệp vụ dùng prefix `/api/v1`; endpoint cần token gửi header `Authorization: Bearer <token>`.

| Method | Path                                       | Quyền              | Description                                |
| ------ | ------------------------------------------ | ------------------- | ------------------------------------------ |
| GET    | `/health`                                | Công khai          | Health check                               |
| POST   | `/api/v1/auth/login`                     | Công khai          | Đăng nhập (username/email) → JWT       |
| POST   | `/api/v1/auth/gmail-login`               | Công khai          | Đăng nhập bằng Google ID token         |
| POST   | `/api/v1/auth/forgot-password`           | Công khai          | Gửi OTP khôi phục mật khẩu (email)    |
| POST   | `/api/v1/auth/verify-otp`                | Công khai          | Xác minh OTP                              |
| POST   | `/api/v1/auth/reset-password`            | Công khai          | Đặt lại mật khẩu                      |
| POST   | `/api/v1/chat`                           | Đã đăng nhập   | Hỏi đáp RAG (đồng bộ, có nguồn)    |
| POST   | `/api/v1/chat/stream`                    | Đã đăng nhập   | Hỏi đáp RAG streaming (SSE)             |
| GET    | `/api/v1/conversations`                  | Đã đăng nhập   | Danh sách hội thoại của user           |
| GET    | `/api/v1/conversations/{id}/messages`    | Chủ sở hữu/admin | Lịch sử tin nhắn của hội thoại       |
| GET    | `/api/v1/stats/overview`                 | Đã đăng nhập   | Số liệu dashboard theo vai trò          |
| POST   | `/api/v1/documents/upload`               | admin, lecturer     | Tải lên & ingest tài liệu              |
| GET    | `/api/v1/documents/available`            | Đã đăng nhập   | Tài liệu được phép xem theo vai trò |
| GET    | `/api/v1/documents/{id}/download`        | admin, lecturer     | Tải bản gốc (presigned URL từ R2)      |
| GET    | `/api/v1/students` · `/api/v1/exams`  | admin, lecturer     | Quản lý sinh viên / lịch thi (CRUD)    |
| GET    | `/api/v1/users` · POST `/create-user` | admin               | Quản lý người dùng                    |

> Danh sách rút gọn; xem đầy đủ tại Swagger UI `http://localhost:8000/docs`.

## Deliverables Checklist

- [X] Source Code (GitHub) — `src/`, `frontend/`
- [X] README.md — `README.md` (chi tiết) + `README_boilerplate.md` (template)
- [X] Architecture Diagram — `ARCHITECTURE.md`, `Architecture.png`
- [X] AI Logs (auto-collected) — `.ai-log/`, hooks ở `scripts/`
- [X] Live URL / Deploy — Render (backend + frontend), cấu hình `render.yaml` · `DEPLOY.md`
- [ ] Video Demo — `presentation/`
- [ ] Pitch Deck — `presentation/`
- [X] Weekly Journal — `JOURNAL.md`
- [X] Worklog — `WORKLOG.md`
- [X] Evaluation Evidence — `eval/results/` (LLM-judge: faithfulness 0.94, relevancy 0.88)

## Team

| Member              | Role                                                | Student ID  |
| ------------------- | --------------------------------------------------- | ----------- |
| Hoàng Văn Anh     | AI/Backend Lead — RAG agent, pipeline, DB, deploy  | 2A202600762 |
| Nguyễn Thành Lộc | Frontend — UI/UX, tích hợp API, streaming chat   | 2A202600817 |
| Phạm Tuyết Nga    | Project Management — charter, QA, tài liệu, demo | 2A202600877 |

## License

MIT — Sử dụng tự do cho mục đích giáo dục.
