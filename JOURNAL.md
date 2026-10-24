# Weekly Journal — Team C2-App-142

---

## Week 1: [01-06-2026] - [06-06-2026]

### Mục tiêu tuần này

- [X] Chốt ý tưởng sản phẩm: chatbot RAG hỗ trợ hỏi đáp tài liệu học tập và tài liệu dự án.
- [X] Thiết kế architecture diagram cho hệ thống gồm Frontend, FastAPI Backend, LangGraph Agent, Database và Vector Store.
- [X] Hoàn thành UX/UI prototype cho luồng chat, xem nguồn trích dẫn và thao tác với tài liệu.
- [X] Hoàn thành project charter, phân công vai trò, pain point, phạm vi MVP và kế hoạch quản lý dự án.
- [X] Thiết lập cấu trúc dự án ban đầu, AI usage logging và các deliverable nền tảng.

### Đã hoàn thành

- Xong architecture diagram mô tả luồng Frontend -> API -> LangGraph Agent -> LLM/Vector Store/Database.
- Hoàn thành prototype mẫu cho MVP, tập trung vào trải nghiệm hỏi đáp tài liệu, hiển thị câu trả lời và nguồn tham chiếu.
- Xác định stack kỹ thuật chính: FastAPI, LangGraph, OpenAI LLM, embedding model, Qdrant, SQLite/PostgreSQL và Docker.
- Hoàn thành project charter, danh sách pain point, user story cấp cao và kế hoạch làm việc nhóm.
- Cài đặt/kiểm tra cấu trúc repository, tài liệu hướng dẫn, worklog, journal và AI log hooks.

### Khó khăn & Giải pháp

| Khó khăn                                                                                                          | Giải pháp                                                                                               | Kết quả                                                                      |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Chưa thống nhất rõ MVP nên dễ bị lan sang quá nhiều tính năng.                                           | Chốt phạm vi ưu tiên: ingest tài liệu mẫu, chat RAG, lưu hội thoại và trả nguồn trích dẫn. | Nhóm có cùng hướng triển khai và dễ chia việc hơn.                   |
| Thiết kế kiến trúc cần cân bằng giữa yêu cầu Demo Day và khả năng hoàn thành trong thời gian ngắn. | Dùng kiến trúc 3 lớp: UI, FastAPI/LangGraph, Database + Vector Store; ghi lại bằng diagram.         | Có blueprint rõ để backend, frontend và dữ liệu phát triển song song. |
| Việc xử lý và setup AI log còn mới với nhóm.                                                                | Đọc script logging có sẵn, kiểm tra hook và ghi lại cách dùng log thủ công khi cần.           | Có thể sử dụng AI log phục vụ yêu cầu deliverable của dự án.        |

### Bài học

- Cần chốt phạm vi MVP thật sớm để tránh làm nhiều phần rời rạc nhưng không nối được thành demo.
- Architecture diagram giúp nhóm giao tiếp nhanh hơn vì mọi người nhìn được luồng dữ liệu và trách nhiệm từng phần.
- Với dự án RAG, chất lượng câu trả lời phụ thuộc nhiều vào ingestion, chunking, embedding và truy xuất nguồn chứ không chỉ phụ thuộc vào LLM.

### Kế hoạch tuần sau

- [X] Triển khai database schema cho user, document, chunk, conversation, message, citation và agent run.
- [X] Xây pipeline ingest PDF mẫu: parse, chunk, embed và upsert vào vector store.
- [X] Hoàn thiện API chat và API ingest để phục vụ demo end-to-end.
- [X] Bổ sung test cho API, agent graph, database model và service RAG.

---

## Week 2: [07-06-2026] - [13-06-2026]

### Mục tiêu tuần này

- [X] Xây dựng database schema cho role, user, document, document chunk, conversation, message, citation và agent run.
- [X] Hoàn thiện ingestion pipeline cho bộ PDF mẫu trong `eval/datasets/rag_sample/docs`.
- [X] Kết nối embedding service và Qdrant vector store để lưu/truy xuất chunk liên quan.
- [X] Xây LangGraph RAG agent gồm validate input, save user message, embed query, retrieve context, generate answer và save assistant message.
- [X] Hoàn thiện FastAPI endpoints cho ingest sample dataset, chat và status.
- [X] Bổ sung Pydantic schemas cho chat response có sources và ingest response có thống kê documents/chunks/points.
- [X] Viết test cho API routes, agent graph, chunking, vector store và database models.
- [X] Thay dataset mẫu bằng bộ tài liệu mới trong `datasets/docs` và làm lại data pipeline (clean text, lọc trùng, chunk).
- [X] Viết script ingest idempotent và chạy evaluation RAG đầu tiên trên dataset mới.
- [X] Cập nhật worklog/journal để phản ánh tiến độ thật của cả ba thành viên.

### Đã hoàn thành

- Backend đã có endpoint `POST /api/v1/datasets/rag-sample/ingest` để nạp PDF mẫu vào database và Qdrant.
- Backend đã có endpoint `POST /api/v1/chat` gọi LangGraph RAG agent và trả về câu trả lời kèm danh sách nguồn.
- Database model đã bao phủ dữ liệu người dùng, tài liệu, chunk, hội thoại, message, citation và agent run để theo dõi lịch sử xử lý.
- Pipeline RAG đã tách thành các service rõ ràng: parser PDF, chunking, embeddings, vector store, ingestion và LLM generation.
- LangGraph agent đã được tổ chức theo node để dễ test, dễ mở rộng và dễ debug.
- Bộ test đã kiểm tra API, graph flow, validate input, chunking, Qdrant search wrapper và database schema.
- Đã thay bộ dataset cũ bằng 3 tài liệu mới trong `datasets/docs` và xây `src/services/data_pipeline.py`: parse PDF/DOCX/PPTX, làm sạch text, lọc trùng, chunk ~900 token (overlap 120), cho ra 291 chunks sạch.
- Đã có `scripts/ingest.py` idempotent (bỏ qua tài liệu không đổi, hỗ trợ `--force`/`--reset`, dọn points mồ côi trên Qdrant) và `scripts/view_chunks.py` để kiểm tra chất lượng chunk.
- Đã chạy evaluation RAG đầu tiên trên dataset mới: 4/4 câu có trả lời, 3/4 citation đúng nguồn, 4/4 từ chối câu ngoài phạm vi, latency trung bình ~5.4s; report lưu tại `eval/results/`.
- Nhóm đã cập nhật hướng frontend/prototype và research pain point để chuẩn bị kết nối UI với backend.

### Khó khăn & Giải pháp

| Khó khăn                                                                                                                   | Giải pháp                                                                                                         | Kết quả                                                            |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Cần nối nhiều phần backend trong cùng một luồng RAG: DB, embedding, vector store, LLM và citations.                  | Tách logic thành service/repository/node riêng, sau đó nối bằng LangGraph.                                   | Code dễ đọc hơn và có thể test từng phần độc lập.        |
| Vector store có thể lỗi khi collection đã tồn tại hoặc payload thiếu dữ liệu.                                     | Thêm`ensure_collection`, xử lý trường hợp collection đã tồn tại và chuẩn hóa payload chunk/document. | Ingest và search ổn định hơn cho demo.                          |
| API chat cần trả lời có nguồn để tránh hallucination và tăng độ tin cậy.                                        | Thiết kế`Source` schema, lấy chunk từ DB sau vector search và lưu citations theo message.                   | Response có thể hiển thị nguồn document, page, chunk và score. |
| Test không nên phụ thuộc API key hoặc dịch vụ ngoài.                                                                 | Dùng monkeypatch/fake agent/fake client cho route, graph và Qdrant wrapper.                                       | Có test nhanh, ít phụ thuộc môi trường ngoài.                |
| Chunks từ dataset cũ có nhiều rác (header/footer, ký tự lỗi, đoạn trùng lặp) làm giảm chất lượng retrieval. | Làm lại data pipeline: chuẩn hóa unicode, lọc đoạn quá ngắn, dedupe theo nội dung trước khi chunk.      | 291 chunks sạch, retrieval trả nguồn chính xác hơn.            |
| Chạy ingest lặp lại gây trùng points trên Qdrant và sót points của tài liệu đã xóa.                            | Ingest idempotent theo hash tài liệu, bỏ qua file không đổi và dọn points mồ côi sau mỗi lần chạy.     | Có thể chạy lại ingest an toàn cho demo/deploy.                 |

### Bài học

- Với RAG, cần lưu metadata nguồn ngay từ ingestion để khi chat có thể truy vết câu trả lời.
- LangGraph phù hợp khi pipeline có nhiều bước và cần lưu state qua từng node.
- Repository layer giúp backend gọn hơn vì route và agent node không phải viết trực tiếp quá nhiều truy vấn DB.
- Test bằng fake client/fake agent giúp nhóm kiểm tra logic chính mà không cần gọi OpenAI hoặc Qdrant thật trong mọi lần chạy.
- Chất lượng chunk quan trọng hơn số lượng: làm sạch và lọc trùng dữ liệu trước khi embed cải thiện retrieval rõ rệt mà không cần đổi model.
- Script ingest cần idempotent ngay từ đầu để chạy lặp lại an toàn, tránh trùng dữ liệu khi demo và deploy.

### Kế hoạch tuần sau

- [X] Hoàn thiện kết nối frontend với endpoint chat/ingest để demo luồng người dùng hoàn chỉnh.
- [X] Mở rộng bộ câu hỏi evaluation và cải thiện chất lượng retrieval (ngưỡng score, số lượng context).
- [X] Cập nhật README, architecture document và presentation theo sản phẩm thật.
- [X] Kiểm tra Docker Compose, biến môi trường và hướng deploy.
- [X] Chuẩn bị video demo, pitch deck và checklist deliverables.

---

## Week 3: [14-06-2026] - [20-06-2026]

### Mục tiêu tuần này

- [X] Nâng chất lượng chatbot RAG: chống trả lời bịa, hybrid rerank, hỏi nối tiếp theo ngữ cảnh, trả lời streaming và đo lường bằng LLM-judge.
- [X] Hoàn thiện phân quyền tài liệu theo vai trò (school/personal) và để giảng viên upload/quản lý tài liệu cá nhân.
- [X] Bổ sung nghiệp vụ học vụ cho giảng viên (quản lý sinh viên, lịch thi) và phân loại tài liệu cho admin.
- [X] Thêm hạ tầng cho luồng tài liệu: object store R2, hàng đợi Redis/arq xử lý nền và reverse proxy NGINX.
- [X] Lưu hội thoại chat vào DB (sinh viên + giảng viên) và dựng dashboard số liệu realtime thay cho dữ liệu mock.
- [X] Thêm luồng quên mật khẩu bằng OTP email và cấu hình triển khai Docker + Render.

### Đã hoàn thành

- Chatbot RAG nâng cấp: ngưỡng điểm chống bịa (`rag_min_score`), giới hạn token context, prompt Markdown + trích dẫn; hybrid rerank dense + BM25 (RRF); lịch sử hội thoại + query rewriting cho câu hỏi nối tiếp; streaming token theo SSE `/api/v1/chat/stream`; eval harness LLM-judge (faithfulness 0.94, relevancy 0.88), mở rộng bộ câu hỏi từ 4 lên 10.
- Frontend chat hiển thị câu trả lời kiểu gõ chữ (streaming), render Markdown (in đậm, bảng, code) bằng `react-markdown`, dọn lại phần hiển thị nguồn trích dẫn cho đúng số `[n]`.
- Phân quyền tài liệu hoàn chỉnh: mỗi document có `scope` (school/personal) + owner + subject; filter truy hồi theo vai trò (student→school, lecturer→school + cá nhân, admin→tất cả); giảng viên upload/xóa tài liệu cá nhân; admin phân loại tài liệu (regulation/syllabus).
- Nghiệp vụ học vụ giảng viên: model Student + Exam, CRUD đầy đủ + RBAC (giảng viên chỉ thấy dữ liệu của mình), trang quản lý sinh viên và lịch thi phía FE.
- Hạ tầng: R2 (Cloudflare) lưu bản gốc tài liệu + endpoint tải bản gốc (presigned URL); Redis + arq xử lý ingest nền (upload trả "queued" ngay, worker xử lý → "ready"); NGINX reverse proxy serve frontend + proxy API + tắt buffering cho SSE.
- Hội thoại realtime: API `/conversations` (list/messages/rename/delete) + `/stats/overview` theo vai trò; hook FE dùng chung `useChatConversations`; dashboard admin/giảng viên hiển thị số liệu thật; chat indicator kiểu Claude Code (TypingIndicator).
- Quên mật khẩu bằng OTP email (4 endpoint /auth, OTP 6 số hết hạn 5 phút) + FE đa bước email→OTP→mật khẩu mới, có fallback log OTP ra console khi chạy local.
- Cấu hình triển khai: Dockerfile backend/frontend 2-stage, docker-compose full-stack (Postgres + Redis + backend + worker + frontend), Blueprint `render.yaml`; bắt đầu deploy live lên Render và debug các lỗi môi trường thật.

### Khó khăn & Giải pháp

| Khó khăn                                                                                                                                     | Giải pháp                                                                                                                      | Kết quả                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Chatbot dễ trả lời bịa khi context yếu và retrieval chỉ dùng dense embedding nên đôi khi lệch nguồn.                              | Thêm ngưỡng điểm tối thiểu, hybrid rerank dense + BM25 (RRF) và bộ đo LLM-judge để theo dõi faithfulness/relevancy. | Câu trả lời bám nguồn hơn (faithfulness 0.94), đo được chất lượng. |
| Trước đây backend lưu hội thoại nhưng không có API đọc, FE student dùng localStorage nên mỗi tin nhắn tạo 1 hội thoại mới. | Bổ sung`conversation_repo` + API list/messages/rename/delete và hook FE gửi kèm `conversation_id`.                       | Hội thoại liền mạch, có lịch sử và đặt tiêu đề tự động.         |
| Máy không có quyền docker/sudo nên không chạy được Redis/Postgres hệ thống để test queue.                                        | Cài Redis qua conda-forge vào env`venv` để verify local; production dùng `docker-compose` (redis:7-alpine).             | Test được luồng async ingest mà không cần quyền hệ thống.             |
| Deploy free tier Render giới hạn 512MB RAM, docling/torch nặng làm ingest bị OOM giữa chừng.                                            | Thêm bộ trích xuất nhẹ`lightweight_convert` (pypdf/python-docx/python-pptx) bật qua `USE_DOCLING=false`.               | Ingest chạy được trên Render, tài liệu không còn kẹt trạng thái.    |

### Bài học

- Chất lượng chatbot RAG đến từ nhiều lớp (ngưỡng điểm, rerank, query rewriting, prompt) chứ không chỉ từ model — và cần bộ đo định lượng để biết mỗi thay đổi có thực sự tốt hơn không.
- Cần có API đọc hội thoại và truyền `conversation_id` ngay từ đầu, nếu không FE sẽ tự xử lý bằng localStorage và phá vỡ tính liền mạch.
- Hạ tầng nên graceful: R2/Redis/NGINX đều có nhánh no-op khi chưa cấu hình để không chặn môi trường dev.
- Môi trường deploy thật (RAM giới hạn, không có shell, cổng SMTP bị chặn) bộc lộ nhiều vấn đề mà local không thấy, nên cần deploy sớm để phát hiện.

### Kế hoạch tuần sau

- [X] Refactor schema user (bỏ `password_hash`, thêm `username`), cho đăng nhập bằng username hoặc email.
- [X] Thêm đăng nhập bằng Gmail (Google OAuth) và luồng kích hoạt tài khoản mời.
- [X] Khắc phục các lỗi deploy thật: SMTP timeout, port scan timeout, chatbot/kho tài liệu treo.
- [X] Gia cố chatbot (timeout, heartbeat SSE, fallback POST) và mở rộng định dạng upload (.txt/.md).
- [X] Tối ưu chatbot đa ngôn ngữ, bỏ phụ thuộc vai trò khi trả lời và làm lại giao diện kho tài liệu.

---

## Week 4: [21-06-2026] - [27-06-2026]

### Mục tiêu tuần này

- [X] Refactor schema xác thực: bỏ cột `password_hash`, gộp vào `password` (lưu hash), thêm `username` unique; cho đăng nhập bằng username hoặc email.
- [X] Tích hợp đăng nhập bằng Gmail (Google OAuth) cả backend lẫn frontend, kèm luồng kích hoạt tài khoản được mời.
- [X] Đưa hệ thống chạy ổn định trên Render: vá SMTP timeout, port scan timeout và các điểm treo do DDL/`init_db` trong hot-path.
- [X] Gia cố chatbot: chống treo "AI đang trả lời", heartbeat SSE, fallback POST khi stream đứt; mở rộng upload thêm `.txt/.md`.
- [X] Tối ưu chatbot đa ngôn ngữ, trả lời không phụ thuộc vai trò, ép ngôn ngữ trả lời khớp câu hỏi.
- [X] Làm lại giao diện kho tài liệu admin/giảng viên và đồng bộ phạm vi tài liệu giảng viên (school).

### Đã hoàn thành

- Schema xác thực gọn lại: cột `password` lưu hash bcrypt (bỏ plaintext), thêm `username` unique với migration idempotent (backfill từ localpart email); đăng nhập bằng username hoặc email; FE login tự retry 1 lần chống cold-start Render.
- Đăng nhập Gmail (Google OAuth): backend `POST /auth/gmail-login` xác minh Google ID token, chỉ cho user đã tồn tại + active; FE tích hợp Google Identity Services, render nút đăng nhập, điều hướng theo vai trò; sửa lỗi `SyntaxError` (keyword `user=` lặp) làm fail build Render.
- Luồng tài khoản mời: kích hoạt tài khoản pending, đặt mật khẩu kích hoạt cho cả tài khoản Gmail; soft delete user và cập nhật role response.
- Ổn định deploy Render: chuyển gửi email OTP sang Brevo HTTP API (cổng 443) thay SMTP bị chặn; bỏ `init_db()` khỏi `save_user_message_node` (hot-path) để hết treo chat/kho; đưa schema-upgrade ra chạy nền + timeout kết nối để uvicorn bind cổng ngay (hết lỗi "no open ports").
- Gia cố chatbot: thêm timeout + max_retries cho LLM/embeddings; `chat_stream` luôn kết thúc đúng một sự kiện `done`; heartbeat `keep-alive` đầu stream; FE fallback sang POST `/chat` khi stream lỗi; gợi ý tiêu đề upload tức thì từ tên tệp; nhận thêm `.txt/.md/.markdown`.
- Tối ưu chatbot: trả lời không phụ thuộc vai trò người hỏi, hỗ trợ đa ngôn ngữ và ép ngôn ngữ trả lời khớp câu hỏi ở tầng code; nới context RAG; gộp dữ liệu 3 vai trò cho câu trả lời tốt hơn.
- Giao diện: làm lại kho tài liệu admin và giảng viên (card thu gọn mượt, tách cột riêng, cân bằng thẻ phân loại); chỉ báo tài liệu mới cho kho sinh viên; đồng bộ tài liệu giảng viên publish lên scope school; cập nhật profile/cài đặt, xem trước tài liệu inline.

### Khó khăn & Giải pháp

| Khó khăn                                                                                                            | Giải pháp                                                                                                           | Kết quả                                                              |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Render chặn các cổng SMTP outbound (25/465/587) nên gửi OTP qua Gmail SMTP bị timeout dù credentials đúng.   | Thêm kênh gửi qua Brevo HTTP API (cổng 443) khi có`BREVO_API_KEY`, fallback SMTP có timeout + retry.          | OTP gửi được trên container production.                           |
| Chatbot và kho tài liệu treo "đang tải" trên Render do`init_db()`/DDL chạy trong hot-path khóa bảng users. | Bỏ`init_db()` khỏi node lưu tin nhắn; tách schema-upgrade ra chạy nền + `lock_timeout`, skip-if-done.      | Request xác thực không bị khóa; chat trả về bình thường.     |
| Uvicorn báo "no open ports" khi deploy rolling vì lifespan chạy DDL trước khi bind cổng.                        | Lifespan startup nhanh (không DDL chặn), spawn migration nền retry; bind cổng trước.                            | Deploy không còn timeout cổng.                                      |
| SSE qua proxy cross-origin (FE static tách BE) hay bị buffer/đứt khiến chatbot không trả lời.                 | Heartbeat đầu stream để flush header + FE tự fallback sang POST`/chat` khi không nhận token nào.            | Chatbot trả lời ổn định kể cả khi streaming bị chặn.          |
| Chatbot đôi khi trả lời sai ngôn ngữ hoặc lệ thuộc vai trò người hỏi.                                    | Ép ngôn ngữ trả lời khớp câu hỏi ở tầng code + bỏ ràng buộc vai trò trong prompt, gộp dữ liệu chung. | Trả lời nhất quán ngôn ngữ và phù hợp hơn cho mọi vai trò. |

### Bài học

- Hot-path của request tuyệt đối không được chạy DDL hay `init_db()`; migration phải tách khỏi luồng phục vụ và chạy nền có timeout.
- Trên PaaS như Render, ràng buộc môi trường (cổng SMTP bị chặn, không có shell, deploy rolling) cần được lường trước bằng kênh thay thế (HTTP API) và seed tự động khi startup.
- Streaming qua proxy cross-origin cần lớp phòng vệ (heartbeat + fallback) chứ không thể tin tưởng kết nối SSE luôn thông suốt.
- Xử lý ngôn ngữ và vai trò ở tầng code đáng tin cậy hơn là chỉ dựa vào prompt.

### Kế hoạch tuần sau

- [ ] Khóa sổ tính năng (feature freeze) cho MVP và rà soát toàn bộ luồng E2E theo từng vai trò.
- [ ] Tổ chức buổi UAT nội bộ, ghi nhận lỗi và phân loại theo mức độ ưu tiên.
- [ ] Bổ sung test hồi quy cho các luồng auth/chat/upload và đo lại chất lượng RAG trên bộ câu hỏi mở rộng.
- [ ] Tối ưu hiệu năng và chi phí (thời gian phản hồi chat, cold-start, cấu hình Render).
- [ ] Hoàn thiện tài liệu vận hành (DEPLOY.md, README) và chuẩn bị nội dung demo.

---

## Week 5: [28-06-2026] - [04-07-2026] (Kế hoạch)

### Mục tiêu tuần này (dự kiến)

- [ ] Feature freeze: chốt phạm vi tính năng cho Demo Day, không thêm tính năng lớn mới.
- [ ] UAT nội bộ theo 3 vai trò (admin/giảng viên/sinh viên), lập danh sách bug và phân loại P0/P1/P2.
- [ ] Sửa toàn bộ bug P0/P1, viết test hồi quy cho auth, chat streaming, upload/ingest và phân quyền.
- [ ] Đo lại chất lượng RAG trên bộ câu hỏi mở rộng và tinh chỉnh ngưỡng retrieval/context nếu cần.
- [ ] Tối ưu hiệu năng: giảm thời gian phản hồi chat, xử lý cold-start, rà soát cấu hình tài nguyên Render.

### Đã hoàn thành

- (cập nhật cuối tuần)

### Khó khăn & Giải pháp

- (cập nhật cuối tuần)

### Bài học

- (cập nhật cuối tuần)

### Kế hoạch tuần sau

- (cập nhật cuối tuần)

---

## Week 6: [05-07-2026] - [11-07-2026] (Kế hoạch)

### Mục tiêu tuần này (dự kiến)

- [ ] Ổn định bản release cuối: smoke test toàn hệ thống trên môi trường production, vá nốt bug còn lại.
- [ ] Hoàn thiện tài liệu bàn giao: README, DEPLOY.md, architecture document và hướng dẫn vận hành.
- [ ] Chuẩn bị Demo Day: kịch bản demo end-to-end, pitch deck, video demo và dữ liệu seed sạch.
- [ ] Tổng kết dự án: bài học, hạn chế còn lại và hướng phát triển tiếp theo.
- [ ] Rà soát checklist deliverables cuối cùng và bàn giao.

### Đã hoàn thành

- (cập nhật cuối tuần)

### Khó khăn & Giải pháp

- (cập nhật cuối tuần)

### Bài học

- (cập nhật cuối tuần)

### Kế hoạch tuần sau

- (cập nhật cuối tuần)

---

<!-- Tiếp tục copy block trên cho các tuần sau -->
