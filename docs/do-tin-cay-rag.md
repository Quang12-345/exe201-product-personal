# Báo cáo: "Dựa trên tài liệu · độ tin cậy" được tính như thế nào

Tài liệu này giải thích cách hệ thống đánh giá **độ tin cậy** của mỗi câu trả lời AI
(badge hiển thị dưới câu trả lời) và **dựa vào đâu**.

## 1. Trước đây tính sao (và vấn đề)

- Độ tin cậy = `max(điểm cosine của các nguồn)`, tính ở **frontend**, 2 nơi trùng nhau
  (badge + tín hiệu gửi dashboard).
- Ngưỡng nhãn: cao ≥ 0.70 · trung bình ≥ 0.50 · thấp < 0.50.
- **Vấn đề:** điểm cosine của câu hỏi *trong phạm vi tài liệu* (embedding tiếng Việt,
  đoạn ngắn) thực đo chỉ ~**0.46–0.69**. Vì vậy `max` gần như không bao giờ ≥ 0.70 →
  câu trả lời tốt vẫn bị gắn **"thấp"/"trung bình"**. Ngoài ra chỉ dùng 1 tín hiệu
  (điểm cao nhất) nên dễ sai: 1 chunk khớp cao không có nghĩa câu trả lời bám tài liệu.

## 2. Cách tính mới (đa tín hiệu, hiệu chuẩn, tính ở backend)

Tính 1 lần ở backend (`src/services/confidence.py::assess_answer`) → trả về cùng câu
trả lời (sự kiện `done` của stream) và **lưu kèm message** (tải lại hội thoại vẫn đúng);
frontend chỉ hiển thị. Nhờ đó badge và số liệu dashboard **luôn khớp nhau**.

### 2.1. Hiệu chuẩn điểm cosine → [0..1]
Đưa cosine về thang quen thuộc theo dải thực đo:

```
relevance(score) = clamp( (score - floor) / (ceil - floor), 0, 1 )
floor = rag_fallback_min_score  (mặc định 0.22 — mức nhiễu)
ceil  = rag_min_score + 0.35    (mặc định 0.70 — mức "rất khớp")
```

Ví dụ: 0.46 → 0.50 · 0.69 → 0.98 · 0.36 → 0.29.

### 2.2. Bốn tín hiệu thành phần
| Tín hiệu | Ý nghĩa | Cách lấy |
|---|---|---|
| `top_relevance` | Độ liên quan của chunk tốt nhất | hiệu chuẩn cosine cao nhất |
| `avg_relevance` | Tính nhất quán của nhóm nguồn | hiệu chuẩn TB cosine top‑3 |
| `support` | Số nguồn hỗ trợ (bão hoà ở 3) | `min(số nguồn, 3) / 3` |
| `cited` | Câu trả lời **có trích dẫn `[n]`** không | regex `\[\d+\]` trong câu trả lời |

### 2.3. Công thức
```
confidence = 0.45*top_relevance + 0.25*avg_relevance + 0.15*support + 0.15*cited
```
- Nếu câu trả lời **không có trích dẫn `[n]`** → ép `confidence ≤ 0.35` (không thể coi
  là bám tài liệu) và `grounded = false`.
- `grounded = (có nguồn) AND (có trích dẫn)`.

### 2.4. Nhãn
```
cao        : confidence ≥ 0.68
trung bình : confidence ≥ 0.40
thấp       : < 0.40
```

## 3. Thang điểm minh hoạ (đo thực tế)
| Trường hợp | Kết quả |
|---|---|
| 3 nguồn cao (0.69/0.63/0.58) + có trích dẫn | **95% — cao** |
| 1 nguồn 0.46 + có trích dẫn | **55% — trung bình** |
| 1 nguồn 0.36 + có trích dẫn | **40% — trung bình** |
| Có nguồn nhưng KHÔNG trích dẫn | **35% — thấp**, không grounded |
| Từ chối / không nguồn | **0% — thấp**, không grounded |

## 4. Hiển thị & sử dụng
- **Badge dưới câu trả lời:** "Dựa trên tài liệu · độ tin cậy {nhãn} ({phần trăm})";
  rê chuột xem chi tiết 4 tín hiệu. Nếu không grounded → cảnh báo "hãy kiểm chứng".
- **Tín hiệu hệ thống:** gửi `grounded` + `confidence` (giá trị backend) lên dashboard
  *Chất lượng AI* → các ô **"Có nguồn (grounded)"** và **"Độ tin cậy TB (system)"**.
- **Đánh giá offline (RAG eval)** vẫn riêng: faithfulness, answer relevancy, citation
  match... dùng bộ câu hỏi vàng (`scripts/evaluate_rag_sample.py`).

## 5. Hướng phát triển tiếp
- Thêm tín hiệu **đồng thuận dense vs BM25** (rerank) vào công thức.
- Hiệu chuẩn `floor/ceil` tự động theo phân phối điểm thực tế (đo định kỳ).
- Đối chiếu confidence với 👍/👎 thực tế để tinh chỉnh trọng số (calibration learning).
