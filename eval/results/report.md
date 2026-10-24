# Evaluation Metrics

## Kết luận

Benchmark RAG gồm 10 câu hỏi hoàn tất 100%,
và các metric bên dưới là baseline thực tế của cấu hình hiện tại.

## Kết quả thực tế

| Nhóm       | Metric                            |                      Baseline |     Mục tiêu đề xuất |
| ---------- | --------------------------------- | ----------------------------: | -------------------: |
| Vận hành   | Request hoàn tất                  |                  10/10 (100%) |                ≥ 99% |
| Chất lượng | Citation match (in-scope)         |                   5/8 (62.5%) |                ≥ 85% |
| Chất lượng | Faithfulness (LLM-judge, 0–1)     |                         0.817 |               ≥ 0.90 |
| Chất lượng | Answer relevancy (LLM-judge, 0–1) |                         0.875 |               ≥ 0.85 |
| An toàn    | Out-of-scope refusal              |                      0/2 (0%) |                ≥ 95% |
| Hiệu năng  | End-to-end latency trung bình     |                     10,762 ms |          ≤ 10,000 ms |
| Hiệu năng  | Latency p50 / p95                 |            10,357 / 15,468 ms |  ≤ 8,000 / 15,000 ms |
| Chi phí    | Estimated cost trung bình / p95   | US$0.00055413 / US$0.00080490 | ≤ US$0.001 / request |

Chi phí gồm query embedding và LLM trả lời; không gồm LLM-judge, Qdrant, Render
database hoặc hạ tầng.

## Diễn giải

- Hạ tầng và đồng bộ dữ liệu hiện hoạt động: benchmark lấy được source cho các câu
  trong phạm vi, không còn lỗi chunk/vector lệch nhau.
- Citation match 62.5% và faithfulness 0.817 chưa đạt mục tiêu. Hai câu về Google
  Prompt/ML Cheatsheets chưa truy hồi đúng tài liệu mong đợi; cần bổ sung hoặc
  cải thiện nội dung/chunk của các nguồn này.
- Hai câu ngoài phạm vi vẫn được gắn source, khiến refusal rate là 0%. Đây là ưu
  tiên an toàn lớn nhất: cần siết ngưỡng retrieval hoặc thêm bước phát hiện câu
  ngoài phạm vi trước generation.
- p95 latency vượt nhẹ ngưỡng 15 giây. Có thể giảm `top_k`, ngân sách context,
  hoặc bật streaming để cải thiện trải nghiệm chờ của người dùng.

## Tái lập

```bash
python scripts/evaluate_rag_sample.py
```

Kết quả chi tiết theo từng câu, token usage và chi phí nằm trong
[`rag_report.json`](rag_report.json) và [`rag_report.md`](rag_report.md).
