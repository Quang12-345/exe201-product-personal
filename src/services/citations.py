"""Chọn nguồn hiển thị kèm câu trả lời.

Ưu tiên các trích dẫn [n] mà LLM thực sự chèn. Nhưng để ĐẢM BẢO cả student và
lecturer LUÔN thấy nguồn khi câu trả lời dựa trên tài liệu, có thêm cơ chế dự
phòng: nếu mô hình "quên" chèn [n] mà vẫn trả lời từ ngữ cảnh (có nguồn truy hồi
đủ tin cậy, không phải câu "không có dữ liệu"), ta vẫn đính kèm các nguồn đó.
"""

import re

from src.config import get_settings

_CITE_RE = re.compile(r"\[(\d+)\]")

# Ngưỡng độ dài (ký tự) để coi câu trả lời là "có dựa trên tài liệu" khi mô hình
# quên chèn [n] — đủ để loại lời chào/đáp xã giao ngắn.
_MIN_GROUNDED_LEN = 160

# Dấu hiệu câu trả lời KHÔNG dựa trên tài liệu (chào hỏi/từ chối/không đủ dữ liệu)
# — khi đó không đính kèm nguồn dù có chunk truy hồi.
_NO_DATA_MARKERS = (
    "chưa đề cập",
    "không đủ dữ liệu",
    "chưa có thông tin",
    "không có thông tin",
    "không tìm thấy",
    "hasn't covered",
    "has not covered",
    "doesn't mention",
    "does not mention",
    "no relevant information",
    "couldn't find",
    "could not find",
    "not enough information",
    "no information",
)


def cited_indexes(response: str) -> set[int]:
    return {int(n) for n in _CITE_RE.findall(response or "")}


def _looks_like_no_data(response: str) -> bool:
    low = (response or "").lower()
    return any(marker in low for marker in _NO_DATA_MARKERS)


# Câu hỏi GIAO TIẾP/về bản thân trợ lý — không cần tra tài liệu, không nguồn.
_SMALLTALK_RE = re.compile(
    r"^\s*(xin\s*ch[àa]o(\s+[\wàáạảãâăđêôơưỳ-ỹ]+){0,2}|ch[àa]o(\s+[\wàáạảãâăđêôơưỳ-ỹ]+){0,2}|"
    r"hello|hi|hey|c[ảa]m\s*[ơo]n(\s+[\wàáạảãâăđêôơưỳ-ỹ]+){0,2}|thank(s|\s*you)?( so much| a lot)?|"
    r"t[ạa]m\s*bi[ệe]t|bye|goodbye|ok(e|ay)?|good\s*(morning|afternoon|evening)|"
    r"b[ạa]n\s+(l[àa]\s+ai|t[êe]n\s+(l[àa\s]*)?g[ìi]|kh[ỏo]e\s+kh[ôo]ng)|who\s+are\s+you|"
    r"b[ạa]n\s+(d[ùu]ng|đang\s+d[ùu]ng|ch[ạa]y|dang\s+dung)\s.{0,25}(model|m[ôo]\s*h[ìi]nh|ai)[\w\s]{0,15}|"
    r"(ai|who)\s+(t[ạa]o|l[àa]m|created?)\s+(ra\s+)?b[ạa]n|how\s+are\s+you)\s*[?!.~]*\s*$",
    re.IGNORECASE,
)


def is_smalltalk(query: str) -> bool:
    """Câu chào hỏi/xã giao/hỏi về trợ lý → bỏ qua truy hồi tài liệu, không nguồn."""
    q = (query or "").strip()
    return len(q) <= 60 and bool(_SMALLTALK_RE.match(q))


def select_cited_sources(
    response: str, sources: list[dict], *, max_fallback: int = 3
) -> list[dict]:
    """Trả về danh sách nguồn để hiển thị, kèm số trích dẫn `cite`.

    1. Nếu câu trả lời có [n]: chỉ giữ đúng các nguồn được trích (số `cite` = vị trí
       1-based trong `sources`, khớp [n] mà mô hình dùng).
    2. Nếu KHÔNG có [n] nhưng câu trả lời vẫn dựa trên tài liệu (có nguồn đủ tin cậy
       và không phải câu "không có dữ liệu"): đính kèm tối đa `max_fallback` nguồn
       liên quan nhất (đánh số lại 1..n) — để hai bên luôn có nguồn.
    3. Còn lại (chào hỏi/từ chối/không có nguồn): trả về rỗng.
    """
    # Câu TỪ CHỐI THUẦN ("tài liệu chưa đề cập...") mà LLM vẫn lỡ chèn [n] → mâu
    # thuẫn logic (nói không có nguồn nhưng lại kèm nguồn). Câu ngắn = từ chối thuần
    # → bỏ nguồn. Câu dài chứa marker có thể là trả lời MỘT PHẦN → giữ nguồn hợp lệ.
    text = (response or "").strip()
    if _looks_like_no_data(text) and len(text) < 250:
        return []

    cited = cited_indexes(response)
    if cited:
        return [
            {**source, "cite": index}
            for index, source in enumerate(sources, start=1)
            if index in cited
        ]

    if not sources or _looks_like_no_data(response):
        return []

    # Câu trả lời quá ngắn (chào hỏi, một câu xã giao) → không tự gắn nguồn.
    if len((response or "").strip()) < _MIN_GROUNDED_LEN:
        return []

    # Dự phòng: chỉ lấy nguồn ĐỦ TIN CẬY (điểm >= ngưỡng chính) để không gắn nhiễu.
    # Không có nguồn nào đủ tin cậy → không gắn (tránh trích dẫn sai).
    min_score = get_settings().rag_min_score
    confident = [s for s in sources if float(s.get("score") or 0.0) >= min_score]
    if not confident:
        return []
    chosen = confident[:max_fallback]
    return [{**source, "cite": index} for index, source in enumerate(chosen, start=1)]
