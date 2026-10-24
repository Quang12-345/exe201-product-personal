# Worklog — Team C2-App-142

Ghi lại các quyết định kỹ thuật, phân công công việc, brainstorm và bug quan trọng.

---

## [06-06-2026]

| Member           | Task                                                           | Status  | Output                                                                                                                                                 | Time |
| ---------------- | -------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| Hoàng Văn Anh    | Thiết kế architecture diagram và định hướng backend/RAG        | ✅ Done | Hoàn thành sơ đồ kiến trúc Frontend -> FastAPI -> LangGraph Agent -> LLM/Vector Store/Database; xác định các module chính cần triển khai trong `src/`. | 3h   |
| Nguyễn Thành Lộc | Thiết kế giao diện UX/UI và luồng sử dụng MVP                  | ✅ Done | Hoàn thành prototype màn hình chat, luồng người dùng đặt câu hỏi, nhận câu trả lời và xem nguồn trích dẫn; thống nhất hướng giao diện cho frontend.    | 3h   |
| Phạm Tuyết Nga   | Làm project charter, project management và research pain point | ✅ Done | Hoàn thành phạm vi MVP, pain point người dùng, user story cấp cao, phân công vai trò và kế hoạch triển khai theo tuần.                                 | 3h   |

**Tổng kết ngày:** Nhóm đã chốt được ý tưởng chatbot RAG, kiến trúc tổng thể, prototype MVP và tài liệu quản lý dự án. Đây là nền tảng để bước sang triển khai backend, database, API và pipeline xử lý tài liệu.

---

## [09-06-2026] — Backend/RAG MVP

| Member           | Task                                                    | Status  | Output                                                                                                                                                                                                                                                    | Time |
| ---------------- | ------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Hoàng Văn Anh    | Xây pipeline chatbot RAG và database                    | ✅ Done | Hoàn thành schema database cho roles, users, documents, chunks, conversations, messages, citations và agent_runs; xây ingestion pipeline parse PDF -> chunk -> embedding -> Qdrant; hoàn thiện LangGraph flow validate/save/embed/retrieve/generate/save. | 5h   |
| Nguyễn Thành Lộc | Thiết kế backend API và use case story                  | ✅ Done | Hoàn thành FastAPI endpoints `/api/v1/chat`, `/api/v1/datasets/rag-sample/ingest`, `/api/v1/status`; cập nhật Pydantic schemas `ChatRequest`, `ChatResponse`, `Source`, `IngestResponse`; bổ sung test API và agent graph.                                | 4h   |
| Phạm Tuyết Nga   | Làm frontend direction và research pain point cho dự án | ✅ Done | Hoàn thiện research pain point theo nhu cầu hỏi đáp tài liệu học tập; cập nhật luồng frontend cần gọi API chat/ingest, cách hiển thị response, conversation và sources/citations cho bản demo.                                                            | 4h   |

**Tổng kết ngày:** Nhóm đã chuyển phần backend/RAG từ thiết kế sang triển khai chạy được ở mức MVP: có database model, repository, ingestion service, vector store, LangGraph agent, API route và test liên quan. Frontend/prototype cũng đã có hướng kết nối rõ với API để chuẩn bị demo end-to-end.

---

## [12-06-2026] — Data pipeline & Evaluation

| Member           | Task                                                  | Status | Output                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Time |
| ---------------- | ----------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Hoàng Văn Anh    | Làm lại data pipeline, dataset và chạy evaluation RAG | ✅ Done | Thay bộ dataset cũ `datasets/rag_sample` bằng 3 tài liệu mới trong `datasets/docs` kèm `questions.jsonl`; xây `src/services/data_pipeline.py` (parse PDF/DOCX/PPTX -> clean text -> lọc trùng -> chunk ~900 token, overlap 120) cho ra 291 chunks sạch; viết `scripts/ingest.py` idempotent (bỏ qua tài liệu không đổi, hỗ trợ `--force`/`--reset`, dọn points mồ côi trên Qdrant) và `scripts/view_chunks.py`; cập nhật vector store, retrieve node, API routes/schemas; bổ sung test cho data pipeline và ingest script; chạy evaluation RAG (4/4 câu trả lời, 3/4 citation đúng nguồn, 4/4 từ chối câu ngoài phạm vi, latency TB ~5.4s) và lưu report vào `eval/results/`. | 5h   |
| Nguyễn Thành Lộc | Kết nối frontend với API chat/ingest                  | ✅ Done | Cập nhật giao diện chat gọi `POST /api/v1/chat`, hiển thị câu trả lời kèm danh sách nguồn trích dẫn; chuẩn bị luồng demo end-to-end với backend.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 4h   |
| Phạm Tuyết Nga   | Cập nhật tài liệu dự án và chuẩn bị demo              | ✅ Done | Cập nhật README theo cấu trúc dataset/pipeline mới; rà soát checklist deliverables và chuẩn bị nội dung presentation/demo cho tuần tới.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 3h   |

**Tổng kết ngày:** Nhóm đã thay bộ dataset mẫu bằng dữ liệu mới và làm lại toàn bộ data pipeline theo hướng sạch — idempotent: chunks không còn rác, ingest chạy lặp lại an toàn và đã có kết quả evaluation thực tế đầu tiên. Đây là nền tảng dữ liệu ổn định để tuần sau tập trung vào demo end-to-end và deploy.

---

## [13-06-2026] — Ổn định backend, Bảo mật & Tích hợp MVP

| Member           | Task                                                   | Status  | Output                                                                                                                                                                                                                                                                                                                                                 | Time |
| ---------------- | ------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| Hoàng Văn Anh    | Rà soát luồng AI/DB, bảo mật và refactor backend       | ✅ Done | Sửa lỗi chặn môi trường (cài nhầm `jose` → `python-jose`) làm hỏng toàn bộ test/API; làm `embed/retrieve` node soft-fail để `AgentRun` không kẹt trạng thái `running`; thêm xác thực JWT + phân quyền RBAC (`get_current_user`, `require_roles`) bảo vệ endpoint (chat=đăng nhập, users/create-user=admin, ingest=admin/lecturer) + `scripts/create_admin.py`; refactor cấu trúc backend: tách `core/security`, `models` theo domain (chat/dataset/user/auth), `controllers` theo domain, thêm `repositories/user_repo`, bỏ file boilerplate thừa. | 5h   |
| Nguyễn Thành Lộc | Tích hợp Frontend ↔ Backend cho luồng MVP             | ✅ Done | Sửa tầng service FE (không đụng UI): cập nhật `constants` endpoint đúng `/api/v1`, axios interceptor tự gắn JWT + xử lý 401; nối `authService.login` và `student/chatService` vào API thật; thống nhất role `lecturer`. Verify E2E: đăng nhập 3 vai trò → sinh viên chat RAG ra câu trả lời kèm nguồn.                                                  | 4h   |
| Phạm Tuyết Nga   | Seed dữ liệu demo & kiểm thử luồng theo vai trò        | ✅ Done | Chuẩn bị `scripts/seed_demo.py` tạo 3 tài khoản demo (admin/lecturer/student) đăng nhập bằng email; kiểm thử phân quyền (401 khi thiếu token, 403 khi sai vai trò) và rà soát checklist deliverables cho demo.                                                                                                                                          | 3h   |

**Tổng kết ngày:** Backend được rà soát và nâng cấp lên mức sẵn sàng tích hợp: vá lỗi chặn, thêm bảo mật JWT/RBAC, refactor để mỗi tầng có trách nhiệm rõ ràng. Frontend được nối vào backend ở tầng service và đã chạy được một luồng MVP end-to-end (đăng nhập → chat RAG → nguồn) bằng dữ liệu thật.

---

## [14-06-2026] — Nâng cấp chất lượng RAG & Hoàn thiện trải nghiệm

| Member           | Task                                                       | Status  | Output                                                                                                                                                                                                                                                                                                                                                                                              | Time |
| ---------------- | --------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Hoàng Văn Anh    | Phát triển chatbot RAG: chất lượng, truy hồi, hội thoại, đo lường | ✅ Done | (A) Ngưỡng điểm `rag_min_score` chống bịa + giới hạn token context + nâng cấp prompt (Markdown, trích dẫn, xử lý lời chào); (C) hybrid rerank dense + BM25 (RRF) trong `services/retrieval.py`; (B1) lịch sử hội thoại + query rewriting cho câu hỏi nối tiếp; (B2) streaming câu trả lời theo token (SSE) `/api/v1/chat/stream`; (D) eval harness LLM-judge faithfulness/relevancy (faithfulness 0.94, relevancy 0.88), mở rộng bộ câu hỏi 4→10; lọc nguồn chỉ giữ trích dẫn thực sự dùng. Test: 62 pass. | 5h   |
| Nguyễn Thành Lộc | Hoàn thiện trải nghiệm chat phía Frontend                 | ✅ Done | Hiển thị câu trả lời theo kiểu gõ chữ (streaming SSE); render Markdown trong bong bóng chat (in đậm, gạch đầu dòng, bảng, code) bằng `react-markdown`; dọn lại phần hiển thị nguồn trích dẫn cho gọn và đúng số `[n]`.                                                                                                                                                                              | 3h   |
| Phạm Tuyết Nga   | Cập nhật tài liệu dự án                                    | ✅ Done | Viết lại `README.md` khớp trạng thái hệ thống (cấu trúc backend mới, bảng API kèm phân quyền, tài khoản demo, luồng MVP, cách chạy); cập nhật `WORKLOG.md`.                                                                                                                                                                                                                                       | 2h   |

**Tổng kết ngày:** Chatbot RAG được nâng từ mức cơ bản lên mức khá hoàn chỉnh: chống trả lời bịa, truy hồi chính xác hơn (hybrid rerank), hỏi nối tiếp hiểu ngữ cảnh, trả lời streaming hiển thị Markdown đẹp, nguồn trích dẫn gọn-đúng, và đã có bộ đo lường chất lượng (faithfulness 0.94). Tài liệu dự án được đồng bộ với hệ thống thực tế.

---

## [15-06-2026] — Admin phân loại tài liệu & Học vụ giảng viên

| Member           | Task                                                          | Status  | Output                                                                                                                                                                                                                                                                                       | Time |
| ---------------- | ------------------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Hoàng Văn Anh    | Phân loại tài liệu (admin) + nghiệp vụ học vụ (giảng viên)    | ✅ Done | Thêm trường `category` (regulation/syllabus) lưu vào `metadata_json` + payload Qdrant, truyền qua ingestion; thêm model `Student` + `Exam`, repo và `academic_controller` CRUD đầy đủ với RBAC (giảng viên chỉ thấy dữ liệu của mình), routes `/api/v1/students` + `/api/v1/exams`; `scripts/seed_academic.py`. Test: 82 pass. | 5h   |
| Nguyễn Thành Lộc | Trang quản lý tài liệu, sinh viên, lịch thi                  | ✅ Done | FE admin: `DocumentsPage` thêm cột Phân loại + Chủ sở hữu, lọc theo category, nút xóa; FE giảng viên: `StudentsPage` + `ExamsPage` CRUD inline, thêm menu sidebar; `documentService`/`studentService`/`examService` gọi API thật.                                                              | 4h   |
| Phạm Tuyết Nga   | Rà soát phân quyền theo vai trò & kiểm thử dữ liệu học vụ     | ✅ Done | Smoke test theo vai trò (giảng viên thấy 5 SV/2 lịch thi, lọc theo môn, sinh viên gọi → 403, create/delete → 200); rà soát checklist và mô tả nghiệp vụ học vụ trong tài liệu.                                                                                                                | 3h   |

**Tổng kết ngày:** Hoàn thiện nhóm tính năng quản trị nội dung: admin phân loại tài liệu (quy định/giáo trình) và giảng viên có nghiệp vụ học vụ riêng (sinh viên, lịch thi) với phân quyền chặt. Hệ thống bắt đầu phân tách rõ trách nhiệm theo từng vai trò.

---

## [16-06-2026] — Hạ tầng tài liệu & Hội thoại realtime

| Member           | Task                                                              | Status  | Output                                                                                                                                                                                                                                                                                                                | Time |
| ---------------- | ---------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Hoàng Văn Anh    | Hạ tầng R2/Redis/NGINX + API hội thoại & thống kê                | ✅ Done | Thêm R2 (`object_storage.py`, boto3 S3-compatible, graceful no-op) lưu bản gốc + endpoint tải presigned URL; Redis + arq (`task_queue.py`, `worker.py`) xử lý ingest nền (upload trả "queued" → worker → "ready"); NGINX reverse proxy + tắt buffering SSE; `conversation_repo` + API `/conversations` (list/messages/rename/delete) + `/stats/overview` theo vai trò. Test: 94 pass, verify live. | 6h   |
| Nguyễn Thành Lộc | Hook chat dùng chung + dashboard realtime                        | ✅ Done | `useChatConversations` (list + active + messages + send với `conversation_id`); `conversationsApi`/`chatStream`/`statsApi`; viết lại lecturer ChatPage có sidebar hội thoại + streaming + persistence; dashboard admin/giảng viên hiển thị số liệu thật (bỏ mock).                                                       | 5h   |
| Phạm Tuyết Nga   | Kiểm thử luồng hội thoại & tài liệu, cập nhật tài liệu hạ tầng    | ✅ Done | Verify chat liền mạch (2 lần cùng `conversation_id` → 1 hội thoại), phân quyền đọc hội thoại (giảng viên đọc của sinh viên → 403); viết `deploy/README.md` hướng dẫn 3 thành phần hạ tầng và thứ tự khởi động.                                                                                                          | 3h   |

**Tổng kết ngày:** Bổ sung lớp hạ tầng cho luồng tài liệu (object store + queue + reverse proxy) và chuyển hội thoại/dashboard từ mock sang dữ liệu thật lưu DB. Hệ thống đã có nền tảng vận hành gần với production.

---

## [17-06-2026] — Realtime toàn bộ, Quên mật khẩu OTP & Cấu hình deploy

| Member           | Task                                                          | Status  | Output                                                                                                                                                                                                                                                                              | Time |
| ---------------- | ------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Hoàng Văn Anh    | Realtime toàn bộ FE, OTP reset & cấu hình Docker/Render       | ✅ Done | Bỏ nốt mock FE (user/document/analytics → API thật), thêm `DELETE /users/{id}` + `/documents/available`, chat indicator (TypingIndicator); fallback dev log OTP ra console cho luồng quên mật khẩu; viết Dockerfile BE/FE 2-stage, `docker-compose` full-stack và Blueprint `render.yaml`, `init_db` ở lifespan. Test: 100→113 pass. | 6h   |
| Nguyễn Thành Lộc | FE quên mật khẩu đa bước & xử lý realtime                     | ✅ Done | Viết lại `ForgotPasswordPage` đa bước (email → OTP 6 số → mật khẩu mới ≥8, có gửi lại mã); `authService` thêm `verifyOtp`/`resetPassword`; ẩn bubble AI rỗng + hiện TypingIndicator khi đang gửi.                                                                                    | 4h   |
| Phạm Tuyết Nga   | Kiểm thử OTP & rà soát checklist deploy                       | ✅ Done | Verify luồng forgot → verify-otp → reset → login bằng mật khẩu mới; rà soát biến môi trường cho Docker/Render và checklist deliverables trước khi deploy thật.                                                                                                                      | 3h   |

**Tổng kết ngày:** Gần như xóa hết dữ liệu mock — toàn bộ FE đọc số liệu thật; thêm luồng quên mật khẩu bằng OTP email và chuẩn bị đầy đủ cấu hình triển khai Docker + Render để đưa hệ thống lên môi trường thật.

---

## [18-06-2026] — Refactor schema xác thực & Debug deploy Render

| Member           | Task                                                          | Status  | Output                                                                                                                                                                                                                                                                            | Time |
| ---------------- | ------------------------------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Hoàng Văn Anh    | Refactor schema user + vá lỗi deploy live trên Render         | ✅ Done | Bỏ cột `password_hash`, gộp `password` (lưu hash) + thêm `username` unique với migration idempotent; login bằng username hoặc email; trên Render: vá lỗi `VITE_API_URL`/CORS, thêm `SEED_DEMO` tự seed khi startup (Render free không có shell), thêm `lightweight_convert` (`USE_DOCLING=false`) chống OOM ingest. Test: 114 pass. | 6h   |
| Nguyễn Thành Lộc | FE login chống cold-start & xác thực dữ liệu                  | ✅ Done | `authService.login` timeout 60s + auto-retry 1 lần (sửa lỗi "phải bấm 2 lần" do cold-start Render); `LoginPage` disable khi loading; gia cố đọc `session.user.role`.                                                                                                               | 3h   |
| Phạm Tuyết Nga   | Kiểm thử trên môi trường deploy & cập nhật README             | ✅ Done | Verify đăng nhập 3 vai trò trên Render, kiểm tra upload/chat sau khi bật `USE_DOCLING=false`; cập nhật README và DEPLOY.md theo cấu hình thật.                                                                                                                                      | 3h   |

**Tổng kết ngày:** Dọn lại schema xác thực cho gọn-chuẩn và đưa hệ thống lên Render chạy thật — phát hiện và vá hàng loạt vấn đề chỉ xuất hiện ở môi trường production (CORS, seed, OOM ingest). Đây là bước chuyển từ "chạy local" sang "chạy được trên cloud".

---

## [21-06-2026] — Giao diện chat dùng chung & Quản lý câu trả lời đã lưu

| Member           | Task                                                       | Status  | Output                                                                                                                                                                                                                  | Time |
| ---------------- | --------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Hoàng Văn Anh    | Chuẩn hóa response vai trò & soft delete                  | ✅ Done | Cập nhật user role response và thêm soft delete cho user (không xóa cứng); rà soát lại điểm chạm phân quyền để chuẩn bị cho luồng tài khoản mời tuần này.                                                               | 4h   |
| Nguyễn Thành Lộc | Giao diện chat dùng chung & lưu câu trả lời               | ✅ Done | Tách `ChatMessage` dùng chung cho student/lecturer + auto-scroll; thêm lưu/xóa/xem chi tiết câu trả lời đã lưu (localStorage); hyperlink logo, disable nút gửi khi đang xử lý.                                          | 4h   |
| Phạm Tuyết Nga   | Bổ sung giao diện & ghi nhận bug trải nghiệm              | ✅ Done | Vibe lại trải nghiệm người dùng qua giao diện, ghi nhận các bug nhỏ (comment) và đối chiếu với luồng nghiệp vụ để xử lý dần.                                                                                            | 3h   |

**Tổng kết ngày:** Hợp nhất giao diện chat cho hai vai trò và thêm tính năng lưu câu trả lời, đồng thời chuẩn hóa response vai trò + soft delete ở backend làm nền cho luồng tài khoản mời sắp tới.

---

## [22-06-2026] — Đăng nhập Gmail & Schema username/password

| Member           | Task                                                         | Status  | Output                                                                                                                                                                                                                                                  | Time |
| ---------------- | ----------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Hoàng Văn Anh    | Sửa build Gmail login + hoàn thiện schema xác thực           | ✅ Done | Sửa `SyntaxError` (keyword `user=` lặp trong `gmail_login_controller`) làm fail build Render; implement FE đăng nhập Gmail (Google Identity Services, render nút, điều hướng theo vai trò); chốt schema `username`/`password` cho login linh hoạt. Test: 121 pass. | 5h   |
| Nguyễn Thành Lộc | UI đăng nhập Gmail, tìm kiếm & dark theme                    | ✅ Done | Hoàn thiện UI nút đăng nhập Gmail; implement chức năng tìm kiếm; sửa bug CSS theme dark; bổ sung lịch sử (history) cho chat.                                                                                                                            | 4h   |
| Phạm Tuyết Nga   | Giao diện quên mật khẩu & kiểm thử đăng nhập                 | ✅ Done | Hoàn thiện giao diện quên mật khẩu bằng mã xác thực (authentication code); kiểm thử các luồng đăng nhập (username/email/Gmail) và ghi nhận bug.                                                                                                         | 3h   |

**Tổng kết ngày:** Bổ sung đăng nhập bằng Gmail (Google OAuth) cho cả backend lẫn frontend và chốt schema xác thực linh hoạt (username hoặc email), kèm các cải thiện giao diện tìm kiếm/dark theme/quên mật khẩu.

---

## [23-06-2026] — Tối ưu upload tài liệu & Khắc phục SMTP deploy

| Member           | Task                                                      | Status  | Output                                                                                                                                                                                                                              | Time |
| ---------------- | -------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Hoàng Văn Anh    | Tối ưu upload/xem tài liệu + fix email OTP trên Render    | ✅ Done | Tối ưu luồng upload tài liệu, sửa lỗi xem tài liệu và lỗi tài liệu/user; chuyển gửi OTP sang Brevo HTTP API (cổng 443) vì Render chặn cổng SMTP outbound → hết `SMTPConnectTimeoutError`; thêm exception email riêng. Test: 122 pass. | 5h   |
| Nguyễn Thành Lộc | Giao diện upload, review & chỉnh sửa tài liệu             | ✅ Done | Bổ sung giao diện upload tài liệu, màn hình review document và giao diện chỉnh sửa cho giảng viên; commit đăng nhập bằng Google ở FE.                                                                                               | 4h   |
| Phạm Tuyết Nga   | Hoàn thiện luồng quên mật khẩu & xem trước tài liệu       | ✅ Done | Commit luồng quên mật khẩu hoàn chỉnh; thêm xem trước tài liệu inline + mở rộng danh sách môn học (VinUni); kiểm thử luồng upload → review.                                                                                          | 4h   |

**Tổng kết ngày:** Tối ưu trải nghiệm tài liệu (upload/xem/review/chỉnh sửa) và xử lý dứt điểm lỗi gửi OTP trên Render bằng kênh Brevo HTTP API — một lỗi đặc thù của môi trường PaaS chặn cổng SMTP.

---

## [24-06-2026] — Gia cố chatbot, Upload & Vá điểm treo deploy

| Member           | Task                                                        | Status  | Output                                                                                                                                                                                                                                                                                                  | Time |
| ---------------- | --------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Hoàng Văn Anh    | Hết treo chatbot/kho tài liệu + hết "no open ports"        | ✅ Done | Thêm timeout/max_retries cho LLM/embeddings, `chat_stream` luôn kết thúc đúng 1 sự kiện `done` + heartbeat SSE + FE fallback POST; mở rộng upload `.txt/.md/.markdown`, gợi ý tiêu đề tức thì; bỏ `init_db()` khỏi hot-path lưu tin nhắn; tách schema-upgrade chạy nền + timeout để bind cổng ngay. Test: 128 pass. | 6h   |
| Nguyễn Thành Lộc | Cập nhật danh sách user & luồng cập nhật tài liệu          | ✅ Done | Sửa `listUser`, thêm admin cập nhật thông tin; thêm luồng cập nhật tài liệu (document update flow) và hành động cập nhật hồ sơ/cài đặt người dùng.                                                                                                                                                        | 4h   |
| Phạm Tuyết Nga   | Xem trước tài liệu inline & mở rộng môn học                | ✅ Done | Thêm xem trước tài liệu inline, mở rộng danh sách môn của VinUni; kiểm thử lại luồng chat/upload sau khi gia cố và ghi nhận kết quả.                                                                                                                                                                       | 3h   |

**Tổng kết ngày:** Xử lý dứt điểm các điểm treo của chatbot và kho tài liệu trên deploy (root cause: DDL/`init_db` trong hot-path khóa bảng users) và lỗi "no open ports" khi deploy rolling — hệ thống ổn định hẳn trên Render.

---

## [25-06-2026] — Hợp nhất RAG 3 vai trò & Luồng tài khoản mời

| Member           | Task                                                          | Status  | Output                                                                                                                                                                                                                                  | Time |
| ---------------- | ------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Hoàng Văn Anh    | Gộp dữ liệu RAG 3 vai trò + ghim branch deploy + nới context | ✅ Done | Hợp nhất database/RAG cho 3 vai trò, bổ sung tài liệu mới cho câu trả lời tốt hơn; ghim `branch=main` cho FE+BE redeploy đồng bộ trên Render và nới context RAG; chuẩn hóa default subject/hooks.                                        | 5h   |
| Nguyễn Thành Lộc | Luồng kích hoạt tài khoản mời & chỉ báo tài liệu mới         | ✅ Done | Thêm luồng `user invite pending activation` + đặt mật khẩu kích hoạt cho tài khoản Gmail pending; thêm chỉ báo tài liệu mới cho kho sinh viên.                                                                                          | 4h   |
| Phạm Tuyết Nga   | Kiểm thử tài khoản mời & rà soát chất lượng trả lời          | ✅ Done | Kiểm thử luồng mời → kích hoạt → đăng nhập (cả Gmail), rà soát chất lượng câu trả lời sau khi gộp dữ liệu 3 vai trò và mở rộng tài liệu.                                                                                                  | 3h   |

**Tổng kết ngày:** Hợp nhất dữ liệu RAG cho cả 3 vai trò để chatbot trả lời tốt hơn và bổ sung luồng quản lý tài khoản mời (pending activation) — bao gồm cả việc đặt mật khẩu kích hoạt cho tài khoản Gmail.

---

## [26-06-2026] — Chatbot đa ngôn ngữ & Redesign kho tài liệu

| Member           | Task                                                          | Status  | Output                                                                                                                                                                                                                          | Time |
| ---------------- | ------------------------------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Hoàng Văn Anh    | Tối ưu chatbot: bỏ phụ thuộc vai trò + đa ngôn ngữ           | ✅ Done | Tối ưu backend chatbot: trả lời không phụ thuộc vai trò + hỗ trợ đa ngôn ngữ; ép ngôn ngữ trả lời khớp câu hỏi ở tầng code; refactor/tối ưu luồng chat; sửa hiển thị nguồn (no source khi không thực sự dùng).                  | 5h   |
| Nguyễn Thành Lộc | Redesign kho tài liệu admin & giảng viên                     | ✅ Done | Làm lại giao diện kho tài liệu admin/giảng viên: card thu gọn mượt, tách cột thư viện riêng, cân bằng thẻ phân loại upload; đồng bộ tài liệu giảng viên publish lên scope school.                                               | 4h   |
| Phạm Tuyết Nga   | Kiểm thử đa ngôn ngữ & rà soát giao diện kho                 | ✅ Done | Kiểm thử chatbot trả lời đúng ngôn ngữ câu hỏi cho cả 3 vai trò; rà soát giao diện kho tài liệu mới và đối chiếu phạm vi hiển thị theo vai trò.                                                                                  | 3h   |

**Tổng kết ngày:** Hoàn thiện chatbot ở mức "trả lời đúng ngôn ngữ, không lệ thuộc vai trò, nguồn gọn-đúng" và làm lại toàn bộ giao diện kho tài liệu cho admin/giảng viên — bước hoàn thiện trải nghiệm trước giai đoạn kiểm thử cuối.

---

<!-- Format: copy block trên cho mỗi ngày làm việc -->
