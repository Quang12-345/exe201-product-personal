# Hướng dẫn Đánh giá Thủ công & 5 Kịch bản Test Mẫu (Manual Evaluation Evidence)

Báo cáo này được thiết kế để hướng dẫn thành viên dự án thực hiện kiểm thử thủ công ít nhất **5 test case** trên chatbot RAG, thu thập kết quả thực tế và hoàn thiện mục **Evaluation Evidence** phục vụ yêu cầu của BTC AI20K.

---

## 1. Chuẩn bị Môi trường (Prerequisites)

Trước khi thực hiện kiểm thử thủ công, bạn cần đảm bảo hệ thống đã sẵn sàng:

1. **Cấu hình API Key và Vector Store:**
   - Điền OpenAI API Key thật vào `.env` (`OPENAI_API_KEY=sk-proj-...`).
   - Khởi động Qdrant Vector DB (nếu chạy local qua Docker) hoặc đảm bảo Qdrant Cloud có sẵn. Nếu chạy local, chạy lệnh:
     ```bash
     docker run -d -p 6333:6333 -p 6334:6334 qdrant/qdrant
     ```
   - Chạy service PostgreSQL hoặc chuyển `DATABASE_URL` trong `.env` sang SQLite để test nhanh:
     ```ini
     DATABASE_URL=sqlite:///./data/app.db
     ```

2. **Nạp dữ liệu mẫu (Ingest dataset):**
   - Chạy server backend FastAPI:
     ```bash
     uvicorn src.main:app --reload --port 8000
     ```
   - Gửi yêu cầu HTTP POST đến `/api/v1/datasets/rag-sample/ingest` để nạp các tài liệu trong `datasets/rag_sample/docs/` vào Database & Vector Store. Bạn có thể bấm nút **Ingest** trên giao diện Admin hoặc gọi curl:
     ```bash
     curl -X POST http://localhost:8000/api/v1/datasets/rag-sample/ingest
     ```
   - Xác nhận phản hồi trả về thành công có thống kê số lượng tài liệu (`documents`), chunks và points.

3. **Chạy Frontend (Nếu kiểm thử qua UI):**
     ```bash
     cd frontend
     npm run dev
     ```
     Mở trình duyệt tại địa chỉ `http://localhost:5173`. Bạn cũng có thể kiểm thử trực tiếp bằng Swagger UI tại `http://localhost:8000/docs` thông qua endpoint `POST /api/v1/chat`.

---

## 2. 5 Kịch Bản Kiểm Thử Thủ Công (Manual Test Cases)

Dưới đây là 5 test case thuộc 5 nhóm câu hỏi khác nhau để kiểm tra toàn diện chất lượng của RAG Agent.

### Test Case 1: Câu hỏi Trực tiếp (Direct / Factual)
* **Mục tiêu:** Kiểm tra khả năng tìm kiếm chính xác thông tin trực tiếp từ 1 tài liệu duy nhất.
* **Câu hỏi (Prompt):** `"Day 07 giải thích embedding và vector store dùng để làm gì trong hệ thống RAG?"`
* **Tài liệu tham chiếu:** `1-day07-data-foundations-embedding-vector-store.pdf`
* **Kết quả mong đợi:**
  - Chatbot trả lời rõ: Embedding dùng để chuyển văn bản thành vector biểu diễn ngữ nghĩa; Vector Store dùng để lưu trữ và tìm kiếm các vector này một cách nhanh chóng.
  - Phải hiển thị nguồn trích dẫn đúng tên file `1-day07-data-foundations-embedding-vector-store.pdf`.
  - Độ trễ (Latency) dưới 3s.

### Test Case 2: Câu hỏi Tổng hợp (Synthesis / Multi-hop)
* **Mục tiêu:** Kiểm tra khả năng tổng hợp thông tin từ nhiều trang hoặc nhiều tài liệu khác nhau.
* **Câu hỏi (Prompt):** `"So sánh vai trò của embedding trong Day 07 và retrieval trong Day 08."`
* **Tài liệu tham chiếu:** `1-day07-data-foundations-embedding-vector-store.pdf` và `1-day08-rag-pipeline-v2.pdf`
* **Kết quả mong đợi:**
  - Phản hồi phân biệt rõ: Embedding (Day 07) làm nhiệm vụ mã hóa thông tin văn bản, còn Retrieval (Day 08) làm nhiệm vụ tìm và rút trích các đoạn thông tin liên quan dựa trên embedding đó.
  - Phải hiển thị ít nhất 2 nguồn trích dẫn tương ứng với cả hai tài liệu trên.

### Test Case 3: Yêu cầu Dẫn nguồn và Chi tiết (Citation-Required / Depth)
* **Mục tiêu:** Kiểm tra độ tin cậy và khả năng trích dẫn số trang/đoạn cụ thể của tài liệu bài giảng.
* **Câu hỏi (Prompt):** `"Multi-agent có nên dùng ngay trong MVP RAG không? Dựa vào Day 09 hãy giải thích."`
* **Tài liệu tham chiếu:** `day09-multi-agent-mcp-a2a-new.pdf`
* **Kết quả mong đợi:**
  - Câu trả lời giải thích dựa trên bài giảng Day 09: Không nên dùng ngay vì tăng độ phức tạp, nên bắt đầu bằng Single-Agent trước.
  - Trích dẫn đúng file slide `day09-multi-agent-mcp-a2a-new.pdf` kèm số trang chính xác (nếu hệ thống hỗ trợ parse page_number).

### Test Case 4: Câu hỏi Mơ hồ / Ranh giới (Ambiguous / Boundary)
* **Mục tiêu:** Kiểm tra cách agent xử lý khi câu hỏi không rõ ràng hoặc có thể hiểu theo nhiều nghĩa dựa trên tài liệu.
* **Câu hỏi (Prompt):** `"Tài liệu có nhắc tới cách đánh giá chất lượng retrieval không?"`
* **Tài liệu tham chiếu:** `1-day08-rag-pipeline-v2.pdf` (chương nói về RAG pipeline, đánh giá)
* **Kết quả mong đợi:**
  - Agent cần xác định xem tài liệu Day 08 có phần đánh giá (evaluation) hay không (ví dụ: nhắc về RAGAS, hoặc độ chính xác tìm kiếm).
  - Nếu có, liệt kê ngắn gọn. Nếu không, thông báo trung thực rằng tài liệu chỉ giới thiệu quy trình chung chứ không đi sâu vào công thức đánh giá cụ thể.

### Test Case 5: Câu hỏi Ngoài phạm vi (Out-of-Scope / Guardrail Check)
* **Mục tiêu:** Đảm bảo Agent không bị ảo tưởng (hallucination) và từ chối trả lời các thông tin không có trong tài liệu học tập.
* **Câu hỏi (Prompt):** `"Tài liệu có cung cấp công thức nấu phở truyền thống Việt Nam không?"`
* **Tài liệu tham chiếu:** Không có.
* **Kết quả mong đợi:**
  - Hệ thống trả về câu từ chối chuẩn: `"Không đủ dữ liệu trong tài liệu đã nạp để trả lời câu hỏi này."` (hoặc tương tự, không tự bịa ra công thức nấu phở).
  - Danh sách nguồn trích dẫn (`sources` / `citations`) phải trống rỗng.

---

## 3. Mẫu Ghi nhận Kết quả Thực tế (Actual Output Template)

Khi chạy thực tế 5 câu hỏi trên trên giao diện Chat hoặc Swagger UI, bạn hãy sao chép câu trả lời thực tế của AI và ghi nhận vào bảng dưới đây để hoàn thiện tài liệu nộp BTC:

| STT | Loại Câu Hỏi | Câu hỏi (Prompt) | Kết quả AI phản hồi thực tế (Actual Output) | Các nguồn trích dẫn (Citations) | Độ trễ (Latency) | Đánh giá đạt/không đạt (Status) |
|---|---|---|---|---|---|---|
| **1** | Direct | Day 07 giải thích embedding và vector store dùng để làm gì trong hệ thống RAG? | *(Copy phản hồi của chatbot vào đây)* | `1-day07-...pdf` | ... ms | ⏳ Chờ cập nhật |
| **2** | Synthesis | So sánh vai trò của embedding trong Day 07 và retrieval trong Day 08. | *(Copy phản hồi của chatbot vào đây)* | `1-day07-...pdf`, `1-day08-...pdf` | ... ms | ⏳ Chờ cập nhật |
| **3** | Depth | Multi-agent có nên dùng ngay trong MVP RAG không? Dựa vào Day 09 hãy giải thích. | *(Copy phản hồi của chatbot vào đây)* | `day09-...pdf` | ... ms | ⏳ Chờ cập nhật |
| **4** | Ambiguous | Tài liệu có nhắc tới cách đánh giá chất lượng retrieval không? | *(Copy phản hồi của chatbot vào đây)* | ... | ... ms | ⏳ Chờ cập nhật |
| **5** | Out-of-Scope | Tài liệu có cung cấp công thức nấu phở truyền thống Việt Nam không? | *(Copy phản hồi của chatbot vào đây)* | *(Trống)* | ... ms | ⏳ Chờ cập nhật |

---

## 4. Cách đưa Bằng chứng Kiểm thử vào `eval/results/report.md`

Sau khi bạn đã kiểm thử thủ công và điền bảng trên:
1. Mở file [report.md](file:///c:/Users/looby/C2-App-142/eval/results/report.md).
2. Dưới mục **## 2. Test Results**, tạo thêm một mục con tên là `### Manual Test Cases`.
3. Dán bảng kết quả thực tế trên vào đó.
4. Chụp thêm 1-2 bức ảnh chụp màn hình (Screenshot) giao diện Chat lúc nhận được câu trả lời kèm nguồn trích dẫn và đính kèm vào báo cáo (lưu ảnh trong thư mục `eval/results/` và link tới).
