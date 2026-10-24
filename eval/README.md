# RAG evaluation

> 📘 Giải thích đầy đủ ý nghĩa từng chỉ số, mục đích và cách đọc kết quả:
> xem [BAO-CAO-DANH-GIA.md](BAO-CAO-DANH-GIA.md).

`scripts/evaluate_rag_sample.py` chạy bộ câu hỏi ở
`datasets/docs/questions.jsonl` qua LangGraph agent thực tế và ghi evidence vào
`eval/results/`.

Các chỉ số được đo gồm:

- response completion, citation match (chỉ in-scope), faithfulness và answer relevancy;
- refusal rate cho câu hỏi ngoài phạm vi;
- end-to-end latency: average, p50 và p95 theo nearest-rank;
- token usage và estimated user-request cost. Cost gồm LLM input/output và query
  embedding; không gồm LLM-judge, hạ tầng hoặc ingest.

Mỗi lần benchmark cần dùng một mức giá rõ ràng. Mặc định hiện tại là 0.15 USD/1M
input token, 0.60 USD/1M output token và 0.02 USD/1M embedding token; ghi đè qua
các cờ `--*-price-per-million` khi giá/model thay đổi.
