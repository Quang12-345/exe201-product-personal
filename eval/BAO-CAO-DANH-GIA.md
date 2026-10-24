# Báo cáo Đánh giá (Evaluation) Chatbot RAG — Giải thích chi tiết

> Tài liệu này giải thích **toàn bộ hệ thống đánh giá chất lượng** của chatbot RAG:
> đo cái gì, tính như thế nào, con số nói lên điều gì, ngưỡng đạt/không đạt ra sao,
> và cách chạy lại để lấy số mới. Dành cho cả người kỹ thuật lẫn người review/nộp báo cáo.

---

## 0. Vì sao cần đánh giá (và đánh giá cái gì)

Một chatbot RAG học tập có thể "nghe có vẻ đúng" nhưng thực tế lại:

- Bịa thông tin không có trong giáo trình (**hallucination**),
- Trích dẫn sai tài liệu (người học không kiểm chứng được),
- Trả lời cả những câu ngoài phạm vi (mất an toàn),
- Quá chậm hoặc quá tốn tiền để vận hành.

Vì vậy dự án đánh giá theo **3 tầng độc lập**, mỗi tầng trả lời một câu hỏi khác nhau:

| Tầng | Trả lời câu hỏi | Chạy khi nào | Vị trí |
|---|---|---|---|
| **1. Offline RAG benchmark** | "Hệ thống tốt tới mức nào một cách khách quan?" | Chạy tay khi kiểm định | `scripts/evaluate_rag_sample.py` |
| **2. Online confidence** | "Câu trả lời *này* có đáng tin không?" | Realtime, mỗi lần user chat | `src/services/confidence.py` |
| **3. Manual evaluation** | "Con người thấy nó thực sự hữu ích không?" | Kiểm thử thủ công | `eval/results/manual_evaluation.md` |

**Điểm mấu chốt:** Tầng 1 là *thước đo khách quan trên bộ câu hỏi vàng*; Tầng 2 là *điểm tự tin hệ thống tự chấm cho từng câu khi chạy thật*. Hai cái hoàn toàn khác nhau, không thay thế nhau.

---

## 1. TẦNG 1 — Offline RAG Benchmark (bộ chỉ số chính)

**File chạy:** `scripts/evaluate_rag_sample.py`
**Bộ câu hỏi vàng (golden set):** `datasets/docs/questions.jsonl`
**Kết quả xuất ra:** `eval/results/rag_report.json` + `eval/results/rag_report.md`

### 1.1. Cơ chế hoạt động

1. Đọc từng câu hỏi trong golden set (mỗi dòng JSON gồm: `question`, `expected_document`, `type`).
2. Chạy câu hỏi qua **đúng LangGraph agent thật** (không mô phỏng) với `top_k = 5`.
3. Đo lại: câu trả lời, nguồn trích dẫn, độ trễ, token đã dùng.
4. Chấm điểm bằng nhiều chỉ số (bên dưới), một số dùng **LLM làm giám khảo**.
5. Tổng hợp thành báo cáo.

Golden set hiện có **10 câu**: 8 câu *in-scope* (có trong tài liệu) + 2 câu *out-of-scope* (ngoài tài liệu, để test an toàn).

### 1.2. Giải thích từng chỉ số

#### (A) Response Completion — Tỷ lệ hoàn tất *(nhóm Vận hành)*
- **Đo gì:** agent có chạy xong và trả về câu trả lời không rỗng không; có bị lỗi/timeout không.
- **Cách tính:**
  - `response_non_empty` = có nội dung **VÀ** không lỗi.
  - `failure_rate` = số lần agent lỗi / tổng số câu.
- **Mục đích:** đo **độ ổn định vận hành**. Một hệ thống trả lời hay nhưng 20% request treo là vô dụng.
- **Đọc số:** 100% = mọi câu đều chạy xong. Càng gần 100% càng tốt.

#### (B) Citation Match — Độ chính xác truy hồi (chỉ câu in-scope) *(nhóm Chất lượng)*
- **Đo gì:** nguồn hệ thống trích dẫn có **đúng tài liệu kỳ vọng** không.
- **Cách tính:** chuẩn hóa tên file (bỏ `.pdf`, thay `-` `_` bằng khoảng trắng, viết thường) rồi kiểm tra tên tài liệu kỳ vọng có nằm trong danh sách `sources` trả về không.
- **Mục đích:** đây là proxy cho **retrieval accuracy** (tương đương *Context Precision* trong RAGAS). Trả lời đúng nhưng lấy sai nguồn = người học không kiểm chứng được = không đáng tin.
- **Đọc số:** `5/8 = 62.5%` nghĩa là 5 trong 8 câu in-scope truy hồi đúng tài liệu. Càng cao càng tốt.

#### (C) Out-of-Scope Refusal — Guardrail chống ảo giác *(nhóm An toàn)*
- **Đo gì:** với câu hỏi **ngoài phạm vi** (VD "Thủ đô nước Pháp?"), hệ thống có **từ chối** đúng không.
- **Cách tính:** coi là "từ chối" nếu câu trả lời chứa `"không đủ dữ liệu"` hoặc `"không tìm thấy"`.
- **Mục đích:** chỉ số **an toàn quan trọng nhất** — chống hallucination. Chatbot học tập mà bịa thông tin ngoài giáo trình là lỗi nghiêm trọng.
- **Đọc số:** `2/2 = 100%` là lý tưởng (từ chối cả 2 câu ngoài phạm vi). `0%` là nguy hiểm.

#### (D) Faithfulness — Độ trung thực (LLM-as-judge) *(nhóm Chất lượng)*
- **Đo gì:** câu trả lời có **hoàn toàn suy ra từ context truy hồi** không, hay bịa thêm.
- **Cách tính:** đưa CONTEXT + CÂU TRẢ LỜI cho một LLM đóng vai giám khảo, yêu cầu chấm **0.0–1.0** (1.0 = bám sát tuyệt đối, 0.0 = bịa hoàn toàn). Chỉ chấm câu in-scope có nguồn thật.
- **Mục đích:** chống hallucination ở **mức nội dung** (khác Citation Match đo ở mức nguồn).
- **Đọc số:** 0.817 = trung bình câu trả lời bám tài liệu ~82%. Càng gần 1.0 càng tốt.

#### (E) Answer Relevancy — Độ liên quan (LLM-as-judge) *(nhóm Chất lượng)*
- **Đo gì:** câu trả lời có **giải quyết đúng trọng tâm câu hỏi** không, hay lạc đề.
- **Cách tính:** LLM-judge chấm 0.0–1.0 dựa trên CÂU HỎI + CÂU TRẢ LỜI (không cần context).
- **Khác Faithfulness thế nào:** Faithfulness hỏi *"có bịa không?"*, Relevancy hỏi *"có đúng câu hỏi không?"*. Một câu có thể trung thực với tài liệu nhưng lạc đề — nên cần cả hai.
- **Đọc số:** 0.875 = trung bình trả lời đúng trọng tâm ~88%.

#### (F) Latency — Độ trễ *(nhóm Hiệu năng)*
- **Đo gì:** thời gian end-to-end từ lúc gửi câu hỏi tới khi có câu trả lời đầy đủ.
- **Cách tính:** báo cáo 3 con số — `avg` (trung bình), `p50` (trung vị), `p95` — bằng thuật toán **nearest-rank** (dễ giải thích cho bộ nhỏ).
  - `p50 = 10,357ms` → một nửa số câu nhanh hơn 10.4 giây.
  - `p95 = 15,468ms` → 95% số câu nhanh hơn 15.5 giây.
- **Vì sao dùng p95, không chỉ average:** average che giấu trường hợp chậm bất thường; p95 phản ánh trải nghiệm tệ nhất mà đa số user thực sự gặp.
- **Đọc số:** càng thấp càng tốt. Có 2 phiên bản: *attempt latency* (mọi request) và *successful-request latency* (chỉ request thành công).

#### (G) Cost — Chi phí ước tính *(nhóm Chi phí)*
- **Đo gì:** chi phí OpenAI ước tính **cho mỗi request của người dùng thật**.
- **Cách tính:**
  ```
  cost = (input_tokens × giá_input
        + output_tokens × giá_output
        + embedding_tokens × giá_embedding) / 1,000,000
  ```
  - `input/output tokens`: lấy thực tế từ callback của LangChain.
  - `embedding_tokens`: đếm bằng `tiktoken` (fallback ≈ số ký tự / 4 nếu offline).
- **Lưu ý thiết kế quan trọng:** cost **KHÔNG** tính 2 lần gọi LLM-judge (Faithfulness + Relevancy), vì đó là chi phí *benchmark* chứ không phải chi phí *user chịu trong production*. Cũng không tính Qdrant/Render/hạ tầng.
- **Giá mặc định** (gpt-4o-mini + text-embedding-3-small): 0.15 USD/1M input · 0.60 USD/1M output · 0.02 USD/1M embedding. Có thể override qua CLI và **luôn được lưu trong report** để tái lập chính xác.
- **Đọc số:** avg $0.00055/request nghĩa là ~1,800 câu hỏi mới tốn 1 USD.

### 1.3. Bảng Baseline hiện tại vs Mục tiêu

| Nhóm | Metric | Baseline | Mục tiêu | Trạng thái |
|---|---|---:|---:|:---:|
| Vận hành | Request hoàn tất | 10/10 (100%) | ≥ 99% | ✅ |
| Chất lượng | Citation match (in-scope) | 5/8 (62.5%) | ≥ 85% | ⚠️ |
| Chất lượng | Faithfulness (0–1) | 0.817 | ≥ 0.90 | ⚠️ |
| Chất lượng | Answer relevancy (0–1) | 0.875 | ≥ 0.85 | ✅ |
| An toàn | Out-of-scope refusal | 0/2 (0%) | ≥ 95% | ❌ |
| Hiệu năng | Latency trung bình | 10,762 ms | ≤ 10,000 ms | ⚠️ |
| Hiệu năng | Latency p50 / p95 | 10,357 / 15,468 ms | ≤ 8,000 / 15,000 ms | ⚠️ |
| Chi phí | Cost trung bình / p95 | $0.00055 / $0.00080 | ≤ $0.001 | ✅ |

### 1.4. Diễn giải & việc cần làm (ưu tiên)

1. ❌ **Out-of-scope refusal = 0%** — *nghiêm trọng nhất về an toàn*. 2 câu ngoài phạm vi vẫn bị gắn nguồn nên không từ chối. Hướng xử lý: siết ngưỡng retrieval (`rag_min_score`) hoặc thêm bước phát hiện câu ngoài phạm vi **trước** khi sinh câu trả lời.
2. ⚠️ **Citation match = 62.5%** — 2 tài liệu (Google Prompt, ML Cheatsheets) đang truy hồi sai. Hướng xử lý: cải thiện nội dung/cách chunk của các nguồn này.
3. ⚠️ **p95 latency = 15.5s** — vượt nhẹ ngưỡng. Hướng xử lý: giảm `top_k`, giảm ngân sách context, hoặc bật streaming để cải thiện cảm giác chờ.

### 1.5. Cách chạy lại

```bash
# Cần OPENAI_API_KEY thật trong .env + Qdrant đã có dữ liệu
python scripts/evaluate_rag_sample.py

# Ghi đè đơn giá khi model/giá thay đổi:
python scripts/evaluate_rag_sample.py \
  --input-price-per-million 0.15 \
  --output-price-per-million 0.60 \
  --embedding-price-per-million 0.02
```

Kết quả chi tiết theo từng câu nằm trong `eval/results/rag_report.json` và `rag_report.md`.

---

## 2. TẦNG 2 — Online Confidence ("độ tin cậy" realtime)

**File:** `src/services/confidence.py` → hàm `assess_answer()`

Khác Tầng 1 (offline, trên golden set), tầng này chạy **mỗi lần user chat** để gắn badge
*"Dựa trên tài liệu · độ tin cậy cao/trung bình/thấp"* dưới từng câu trả lời.

### 2.1. Vấn đề nó giải quyết

Trước đây độ tin cậy = `max(cosine)` tính ở frontend, ngưỡng 0.70. Nhưng cosine của câu
hỏi tiếng Việt *trong* phạm vi tài liệu chỉ đo được **~0.46–0.69** → gần như không bao giờ
đạt 0.70 → câu trả lời tốt vẫn bị gắn nhãn "thấp". Ngoài ra chỉ dùng 1 tín hiệu (điểm cao
nhất) dễ sai: một chunk khớp cao không có nghĩa cả câu trả lời bám tài liệu.

### 2.2. Cách tính mới — đa tín hiệu + hiệu chuẩn

Tính **1 lần ở backend** (1 nguồn sự thật), gửi kèm câu trả lời và lưu vào message → tải lại
hội thoại vẫn đúng, và badge luôn khớp số liệu dashboard.

**Bước 1 — Hiệu chuẩn (calibrate) cosine về thang [0..1]:**
```
relevance(score) = clamp( (score - floor) / (ceil - floor), 0, 1 )
floor = 0.22  (ngưỡng nhiễu)
ceil  = 0.70  (mức "rất khớp")
```
Ví dụ: 0.46 → 0.50 · 0.69 → 0.98 · 0.36 → 0.29.

**Bước 2 — 4 tín hiệu thành phần:**

| Tín hiệu | Trọng số | Ý nghĩa | Cách lấy |
|---|:---:|---|---|
| `top_relevance` | 0.45 | Độ liên quan chunk tốt nhất | cosine cao nhất, đã hiệu chuẩn |
| `avg_relevance` | 0.25 | Tính nhất quán của nhóm nguồn | TB top-3 cosine, đã hiệu chuẩn |
| `support` | 0.15 | Số nguồn hỗ trợ (bão hòa ở 3) | `min(số nguồn, 3) / 3` |
| `cited` | 0.15 | Câu trả lời **có trích dẫn `[n]`** | regex `\[\d+\]` |

**Bước 3 — Công thức:**
```
confidence = 0.45·top_relevance + 0.25·avg_relevance + 0.15·support + 0.15·cited
```

**Guardrail:** nếu câu trả lời **không có trích dẫn `[n]`** → ép `confidence ≤ 0.35` và
`grounded = false`. Vì không trích dẫn thì không thể coi là bám tài liệu, dù cosine cao.
`grounded = (có nguồn) AND (có trích dẫn)`.

**Nhãn:** cao ≥ 0.68 · trung bình ≥ 0.40 · thấp < 0.40.

### 2.3. Thang điểm minh họa (đo thực tế)

| Trường hợp | Kết quả |
|---|---|
| 3 nguồn cao (0.69/0.63/0.58) + có trích dẫn | **95% — cao** |
| 1 nguồn 0.46 + có trích dẫn | **55% — trung bình** |
| 1 nguồn 0.36 + có trích dẫn | **40% — trung bình** |
| Có nguồn nhưng KHÔNG trích dẫn | **35% — thấp**, không grounded |
| Từ chối / không nguồn | **0% — thấp**, không grounded |

### 2.4. Nó phục vụ ai

- **Người dùng:** badge độ tin cậy dưới câu trả lời; rê chuột xem chi tiết 4 tín hiệu; nếu
  không grounded → cảnh báo "hãy kiểm chứng".
- **Dashboard "Chất lượng AI":** gửi `grounded` + `confidence` lên các ô *"Có nguồn (grounded)"*
  và *"Độ tin cậy TB (system)"* để theo dõi realtime.

---

## 3. TẦNG 3 — Manual Evaluation (kiểm thử thủ công)

**File:** `eval/results/manual_evaluation.md`

Bắt các lỗi mà metric tự động khó thấy (chất lượng ngôn ngữ, tính hữu ích thực tế). Gồm
**5 kịch bản** đại diện 5 kiểu câu hỏi:

| # | Loại | Kiểm tra điều gì |
|---|---|---|
| 1 | **Direct / Factual** | Tìm thông tin trực tiếp từ 1 tài liệu duy nhất |
| 2 | **Synthesis / Multi-hop** | Tổng hợp thông tin từ nhiều tài liệu |
| 3 | **Citation-Required / Depth** | Trích dẫn đúng số trang/đoạn cụ thể |
| 4 | **Ambiguous / Boundary** | Xử lý câu mơ hồ, trả lời trung thực khi tài liệu không đủ |
| 5 | **Out-of-Scope / Guardrail** | Từ chối đúng câu ngoài phạm vi, không bịa |

Người test chạy 5 câu này trên UI/Swagger, ghi lại câu trả lời thực tế + nguồn + độ trễ +
đạt/không đạt vào bảng trong file để làm bằng chứng.

---

## 4. Mối quan hệ giữa 3 tầng (tóm tắt)

```
                    ┌─────────────────────────────────────────┐
   Golden set  ───▶ │ TẦNG 1: Offline benchmark (khách quan)   │ ──▶ rag_report.md
   (10 câu)         │ citation, faithfulness, relevancy,       │     báo cáo định kỳ
                    │ refusal, latency, cost                   │
                    └─────────────────────────────────────────┘
                    ┌─────────────────────────────────────────┐
   User chat  ────▶ │ TẦNG 2: Online confidence (realtime)     │ ──▶ badge + dashboard
   (mỗi lượt)       │ 4 tín hiệu → confidence + grounded        │
                    └─────────────────────────────────────────┘
                    ┌─────────────────────────────────────────┐
   Con người  ────▶ │ TẦNG 3: Manual 5 kịch bản                │ ──▶ bằng chứng nộp BTC
                    └─────────────────────────────────────────┘
```

- Tầng 1 = "điểm thi trên đề chuẩn" → dùng để cải thiện hệ thống theo thời gian.
- Tầng 2 = "mức độ tự tin cho từng câu" → dùng để cảnh báo user và theo dõi realtime.
- Tầng 3 = "cảm nhận thực tế của con người" → bắt lỗi định tính.

---

## 5. Hướng phát triển tiếp

- Thêm tín hiệu **đồng thuận dense vs BM25 (rerank)** vào công thức confidence.
- **Hiệu chuẩn `floor/ceil` tự động** theo phân phối điểm thực tế (đo định kỳ).
- Đối chiếu confidence với phản hồi 👍/👎 thật để tinh chỉnh trọng số (*calibration learning*).
- Mở rộng golden set (`datasets/docs/questions.jsonl`) để benchmark bao phủ nhiều chủ đề hơn.
- Thêm bước **phát hiện out-of-scope trước generation** để nâng refusal rate từ 0% lên ≥ 95%.
