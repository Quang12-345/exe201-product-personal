"""Hybrid reranking: kết hợp xếp hạng dense (vector) và sparse (BM25) bằng
Reciprocal Rank Fusion (RRF).

Chỉ rerank trên tập ứng viên đã qua ngưỡng dense (cơ chế chống bịa ở
retrieve_node), nên không kéo thêm chunk kém liên quan — BM25 chỉ giúp đưa các
chunk khớp từ khóa/tên riêng/mã số lên đúng vị trí mà embedding nhỏ dễ bỏ sót.
"""

import re
import unicodedata

RRF_K = 60  # hằng số chuẩn của Reciprocal Rank Fusion

_TOKEN_RE = re.compile(r"\w+", re.UNICODE)


def _fold_diacritics(text: str) -> str:
    """Bỏ dấu tiếng Việt ('điều kiện' → 'dieu kien') để BM25 khớp được cả khi
    người dùng gõ KHÔNG DẤU — trước đây 'la gi' không khớp 'là gì' nên sparse
    rank bỏ sót hoàn toàn các câu hỏi thiếu dấu."""
    text = text.replace("đ", "d").replace("Đ", "D")
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")


def tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(_fold_diacritics((text or "").lower()))


def _rank_map(ordered_ids: list[str]) -> dict[str, int]:
    return {cid: rank for rank, cid in enumerate(ordered_ids)}


def hybrid_rerank(query: str, candidates: list[dict]) -> list[dict]:
    """Sắp xếp lại `candidates` (đã có sẵn 'dense_score') theo RRF của dense + BM25.

    Mỗi candidate là dict tối thiểu: {chunk_id, content, dense_score}.
    Trả về cùng danh sách, đã sắp xếp giảm dần theo điểm fusion (kèm 'rrf_score').
    """
    if len(candidates) <= 1:
        return candidates

    # Thứ hạng dense: candidates được giả định đã sort giảm dần theo dense_score.
    dense_ids = [c["chunk_id"] for c in candidates]
    dense_rank = _rank_map(dense_ids)

    # Thứ hạng sparse (BM25) trên chính tập ứng viên.
    from rank_bm25 import BM25Okapi

    corpus_tokens = [tokenize(c.get("content", "")) for c in candidates]
    query_tokens = tokenize(query)

    sparse_rank: dict[str, int] = {}
    if query_tokens and any(corpus_tokens):
        bm25 = BM25Okapi(corpus_tokens)
        scores = bm25.get_scores(query_tokens)
        # Chỉ xếp hạng sparse cho chunk thực sự khớp từ khóa (score > 0); chunk
        # không chứa từ nào của query không được thưởng điểm BM25 (tránh tie oan).
        matched = [i for i in range(len(candidates)) if scores[i] > 0]
        matched.sort(key=lambda i: scores[i], reverse=True)
        sparse_rank = {candidates[i]["chunk_id"]: rank for rank, i in enumerate(matched)}

    def rrf(cid: str) -> float:
        score = 1.0 / (RRF_K + dense_rank[cid])
        if cid in sparse_rank:
            score += 1.0 / (RRF_K + sparse_rank[cid])
        return score

    for c in candidates:
        c["rrf_score"] = rrf(c["chunk_id"])

    return sorted(candidates, key=lambda c: c["rrf_score"], reverse=True)
