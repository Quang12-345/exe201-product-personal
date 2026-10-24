"""Đánh giá ĐỘ TIN CẬY câu trả lời RAG ("Dựa trên tài liệu · độ tin cậy").

VÌ SAO CẦN: trước đây độ tin cậy = max(điểm cosine) tính ở frontend, ngưỡng 0.7/0.5.
Nhưng cosine của câu hỏi TRONG phạm vi tài liệu (embedding tiếng Việt, đoạn ngắn) chỉ
~0.46–0.69 → gần như không bao giờ đạt 0.7 → câu trả lời tốt vẫn bị gắn "thấp".

CÁCH MỚI (tính ở backend, 1 nguồn sự thật): kết hợp NHIỀU tín hiệu rồi hiệu chuẩn
(calibrate) điểm cosine về thang 0–1 theo dải thực đo:
  1. top_relevance  — độ liên quan của chunk tốt nhất (cosine cao nhất, đã calibrate).
  2. avg_relevance  — độ liên quan trung bình của top-3 chunk (tính nhất quán).
  3. support        — số nguồn hỗ trợ (nhiều nguồn ăn khớp → tin hơn; bão hoà ở 3).
  4. cited          — câu trả lời CÓ trích dẫn [n] hay không (bằng chứng bám tài liệu).

confidence = 0.45*top + 0.25*avg + 0.15*support + 0.15*cited  (0..1)
Nhãn: cao ≥ 0.68 · trung bình ≥ 0.40 · thấp < 0.40.
"""

from __future__ import annotations

import re

_CITATION_RE = re.compile(r"\[\d+\]")


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def _calibrate(score: float, *, floor: float, ceil: float) -> float:
    """Đưa cosine [floor..ceil] về [0..1]. floor≈ngưỡng nhiễu, ceil≈mức 'rất khớp'."""
    if ceil <= floor:
        return _clamp(score)
    return _clamp((score - floor) / (ceil - floor))


def assess_answer(
    answer: str,
    sources: list[dict] | None,
    *,
    rag_min_score: float = 0.35,
    rag_fallback_min_score: float = 0.22,
) -> dict:
    """Trả về {grounded, confidence(0..1), level, factors} cho 1 câu trả lời."""
    answer = answer or ""
    sources = sources or []
    scores = sorted(
        (float(s.get("score") or 0.0) for s in sources if s.get("score") is not None),
        reverse=True,
    )
    n_sources = len(sources)
    has_citation = bool(_CITATION_RE.search(answer))
    # QUAN TRỌNG: `sources` truyền vào đây là danh sách ĐÃ QUA LỌC của
    # select_cited_sources (chỉ giữ nguồn được trích [n], hoặc nguồn đủ tin cậy khi
    # LLM quên chèn [n]). Vì vậy: CÓ nguồn = câu trả lời dựa tài liệu — không được
    # đòi thêm [n] inline, kẻo mâu thuẫn "hiển thị nguồn nhưng badge nói không nguồn".
    grounded = n_sources > 0

    # Dải hiệu chuẩn: floor = ngưỡng dự phòng (nhiễu), ceil = trên ngưỡng chính 1 khoảng.
    floor = rag_fallback_min_score
    ceil = rag_min_score + 0.35

    if not scores:
        top_relevance = avg_relevance = 0.0
    else:
        top_relevance = _calibrate(scores[0], floor=floor, ceil=ceil)
        top3 = scores[:3]
        avg_relevance = _calibrate(sum(top3) / len(top3), floor=floor, ceil=ceil)

    support = min(n_sources, 3) / 3.0
    # [n] inline = bằng chứng mạnh nhất; có nguồn (đã lọc) nhưng thiếu [n] = vừa phải.
    cited = 1.0 if has_citation else (0.6 if grounded else 0.0)

    confidence = (
        0.45 * top_relevance + 0.25 * avg_relevance + 0.15 * support + 0.15 * cited
    )
    # KHÔNG có nguồn nào sau lọc → không thể coi là "bám tài liệu".
    if not grounded:
        confidence = min(confidence, 0.35)
    confidence = round(_clamp(confidence), 4)

    level = "cao" if confidence >= 0.68 else "trung bình" if confidence >= 0.40 else "thấp"

    return {
        "grounded": grounded,
        "confidence": confidence,
        "level": level,
        "factors": {
            "top_score": round(scores[0], 4) if scores else 0.0,
            "top_relevance": round(top_relevance, 4),
            "avg_relevance": round(avg_relevance, 4),
            "support": round(support, 4),
            "cited": cited,
            "n_sources": n_sources,
        },
    }
