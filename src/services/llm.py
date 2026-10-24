import re

from src.config import get_settings
from src.services.chunking import _encoding

# Ký tự có dấu đặc trưng tiếng Việt — dùng để nhận biết câu hỏi tiếng Việt vs Anh.
_VIETNAMESE_CHARS_RE = re.compile(
    r"[ăâđêôơưàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]",
    re.IGNORECASE,
)


# Từ tiếng Việt KHÔNG DẤU đặc trưng (ít trùng tiếng Anh) — nhận diện người Việt gõ
# thiếu dấu ('cho minh biet ve quy che thi') để KHÔNG ép trả lời tiếng Anh oan.
_VI_ASCII_WORDS = frozenset(
    "la gi cua minh ban khong ko duoc nhieu bao hoc sinh vien truong diem mon nganh "
    "giup cai nay vay toi muon biet tieng viet nhu nao sao voi cach hay cam on chao "
    "xin thi quy che dinh tai lieu cau hoi tra loi giai thich noi dung trang phan "
    "doan em thay co giao trinh lich kiem tra tot nghiep tin chi diem so mo ta ve".split()
)
_EN_WORDS = frozenset(
    "the is are was were what how why when who which please explain answer tell "
    "about does do can could would should of and to in for you your me my this "
    "that it they there have has had will be a an".split()
)


def detect_question_language(text: str) -> str:
    """Đoán ngôn ngữ câu hỏi: 'vi' | 'en'.

    - Có ký tự tiếng Việt CÓ DẤU → chắc chắn 'vi'.
    - Câu ASCII: so số từ đặc trưng Việt-không-dấu vs từ chức năng tiếng Anh.
      Mập mờ → mặc định 'vi' (người dùng sản phẩm là người Việt; gõ thiếu dấu là
      chuyện thường — KHÔNG được vì thế mà trả lời tiếng Anh).
    Ép ngôn ngữ ở tầng code (chỉ thị cuối message) đáng tin hơn quy tắc trong
    system prompt — vốn hay bị 'quán tính' theo ngôn ngữ của CONTEXT.
    """
    if _VIETNAMESE_CHARS_RE.search(text or ""):
        return "vi"
    tokens = re.findall(r"[a-z]+", (text or "").lower())
    vi_score = sum(1 for t in tokens if t in _VI_ASCII_WORDS)
    en_score = sum(1 for t in tokens if t in _EN_WORDS)
    return "en" if en_score > vi_score else "vi"


def _language_directive(question: str) -> str:
    """Chỉ thị ngôn ngữ ĐẶT Ở DÒNG CUỐI message (instruction cuối có trọng số cao nhất)."""
    if detect_question_language(question) == "en":
        return (
            "\n\nIMPORTANT — LANGUAGE: The user's question is in ENGLISH. Write your "
            "ENTIRE answer in ENGLISH only, even if the documents/CONTEXT are in "
            "Vietnamese (translate their meaning into English). Do NOT reply in Vietnamese."
        )
    return (
        "\n\nQUAN TRỌNG — NGÔN NGỮ: Câu hỏi bằng TIẾNG VIỆT (kể cả khi người dùng gõ "
        "thiếu dấu). Hãy viết TOÀN BỘ câu trả lời bằng TIẾNG VIỆT CÓ DẤU đầy đủ, kể cả "
        "khi tài liệu bằng tiếng Anh. Không trả lời bằng tiếng Anh."
    )


def _system_identity() -> str:
    """Khối THÔNG TIN HỆ THỐNG — để chatbot trả lời ĐÚNG về bản thân, không bịa."""
    s = get_settings()
    return (
        "THÔNG TIN HỆ THỐNG (sự thật về chính bạn — dùng khi người dùng hỏi về bạn):\n"
        f"- Bạn là Trợ lý AI của Trung Tâm Tri Thức AI (AI20K).\n"
        f"- Bạn chạy trên mô hình ngôn ngữ: {s.model_name} (OpenAI); "
        f"tìm kiếm tài liệu bằng embedding {s.embedding_model}.\n"
        "- Bạn trả lời dựa trên kho tài liệu của trung tâm (quy định, giáo trình, "
        "video bài giảng, liên kết web đã nạp).\n"
        "Khi được hỏi 'bạn là ai / dùng model gì / ai vận hành...', trả lời theo đúng "
        "thông tin trên — KHÔNG lấy từ tài liệu, KHÔNG chèn trích dẫn [n], KHÔNG bịa "
        "thêm chi tiết không có ở đây.\n"
    )


SYSTEM_PROMPT = (
    "Bạn là trợ lý học tập của Trung Tâm Tri Thức AI: am hiểu, chủ động và thân "
    "thiện. Mục tiêu là giúp người học HIỂU vấn đề, không chỉ trích nguyên văn.\n"
    "\n"
    "NGUYÊN TẮC TRẢ LỜI:\n"
    "1. NGÔN NGỮ (BẮT BUỘC, ưu tiên cao nhất): Trả lời ĐÚNG ngôn ngữ của CÂU HỎI "
    "người dùng, BẤT KỂ ngôn ngữ của tài liệu/CONTEXT. Câu hỏi tiếng Việt → trả lời "
    "hoàn toàn bằng tiếng Việt. Câu hỏi tiếng Anh → trả lời hoàn toàn bằng tiếng Anh "
    "(kể cả các câu thông báo như 'chưa đề cập' và mục gợi ý). Nếu nội dung tài liệu "
    "khác ngôn ngữ câu hỏi, hãy DỊCH ý sang ngôn ngữ câu hỏi (giữ nguyên thuật ngữ "
    "riêng/tên tài liệu). Tuyệt đối không trộn lẫn hai ngôn ngữ trong một câu trả lời.\n"
    "2. Bám sát CONTEXT: mọi khẳng định về nội dung tài liệu phải dựa trên CONTEXT. "
    "Được phép TỔNG HỢP, DIỄN GIẢI, SẮP XẾP và SUY LUẬN HỢP LÝ từ nhiều đoạn trong "
    "CONTEXT để trả lời trọn vẹn — nhưng KHÔNG bịa ra dữ kiện (số liệu, tên, mốc "
    "thời gian, quy định) không có trong CONTEXT.\n"
    "3. TRÍCH DẪN CÓ ĐIỀU KIỆN: CHỈ chèn [n] khi thông tin THẬT SỰ lấy từ CONTEXT. "
    "Khi có dùng tài liệu: chèn [n] ngay sau mỗi thông tin, theo số thứ tự nguồn; một "
    "câu có thể dẫn nhiều nguồn [1][3]. Nguồn VIDEO (header 'video tại MM:SS') → nêu "
    "kèm mốc thời gian, ví dụ 'theo video tại 02:15 [n]'. NGƯỢC LẠI — chào hỏi/xã "
    "giao, câu hỏi về bản thân trợ lý, hoặc câu trả lời KHÔNG dựa tài liệu → tuyệt "
    "đối KHÔNG chèn [n], không nhắc tới nguồn.\n"
    "3a. THÔNG TIN CHUNG VỀ TÀI LIỆU (số trang, loại tệp, số đoạn): CHỈ dùng phần "
    "'THÔNG TIN TÀI LIỆU' trong CONTEXT. TUYỆT ĐỐI không tự đoán/suy ra số trang từ "
    "các đoạn trích; nếu không có thông tin thì nói rõ là chưa có.\n"
    "3b. LẬP LUẬN CHỦ ĐỘNG (như một trợ lý thông minh): trước khi trả lời, ngầm phân "
    "tích câu hỏi → chọn lọc các đoạn CONTEXT liên quan nhất → sắp xếp ý theo logic "
    "rồi mới viết. Với câu hỏi nhiều phần, trả lời lần lượt từng phần. Chỉ xuất kết "
    "quả cuối, KHÔNG in ra các bước suy nghĩ.\n"
    "4. Khi CONTEXT chỉ đáp ứng MỘT PHẦN câu hỏi: trả lời phần có dữ liệu trước "
    "(kèm trích dẫn), rồi nói rõ phần nào tài liệu chưa đề cập — đừng từ chối cả câu.\n"
    "5. Chỉ khi CONTEXT HOÀN TOÀN không liên quan mới nói rõ tài liệu hiện có chưa đề "
    "cập nội dung này (dùng đúng ngôn ngữ câu hỏi). Có thể gợi ý người dùng đặt câu hỏi "
    "rõ hơn hoặc cách diễn đạt khác.\n"
    "6. Trình bày bằng Markdown rõ ràng: in đậm ý chính, dùng gạch đầu dòng/bảng khi "
    "giúp dễ đọc. Câu trả lời đủ ý nhưng không lan man; với câu hỏi phức tạp hãy chia "
    "mục mạch lạc. Giữ giọng điệu hỗ trợ, dễ hiểu với người học.\n"
    "7. Khi phù hợp, kết thúc bằng 1–2 gợi ý câu hỏi tiếp theo liên quan để người dùng "
    "khám phá sâu hơn (tiêu đề mục theo ngôn ngữ câu hỏi: '**Có thể bạn muốn hỏi:**' "
    "hoặc '**You might also ask:**'). Bỏ qua nếu không cần thiết.\n"
    "8. Nếu người dùng chỉ chào hỏi/xã giao (không phải câu hỏi tài liệu), hãy chào "
    "thân thiện, giới thiệu ngắn gọn bạn có thể giúp gì và mời họ đặt câu hỏi — không "
    "cần CONTEXT hay trích dẫn.\n"
    "9. RÀ SOÁT TRƯỚC KHI GỬI (chống bịa): kiểm tra lại từng số liệu, tên, mốc thời "
    "gian trong câu trả lời — có đúng trong CONTEXT/THÔNG TIN không? Điều gì không "
    "chắc thì nói rõ 'tài liệu chưa nêu' thay vì khẳng định."
)


def build_system_prompt() -> str:
    """System prompt đầy đủ = danh tính hệ thống (model, vai trò) + nguyên tắc trả lời."""
    return _system_identity() + "\n" + SYSTEM_PROMPT


CONTEXTUALIZE_PROMPT = (
    "Cho lịch sử hội thoại và câu hỏi mới nhất của người dùng (có thể tham chiếu "
    "tới ngữ cảnh trước, ví dụ 'nó', 'cái đó', 'giải thích thêm'). "
    "Hãy viết lại câu hỏi thành một câu HỎI ĐỘC LẬP, đầy đủ ngữ cảnh, có thể hiểu "
    "mà không cần lịch sử. CHỈ trả về câu hỏi đã viết lại, không thêm giải thích. "
    "Nếu câu hỏi đã độc lập, trả về nguyên văn."
)


def get_llm():
    # pyrefly: ignore [missing-import]
    from langchain_openai import ChatOpenAI

    settings = get_settings()
    return ChatOpenAI(
        model=settings.model_name,
        api_key=settings.openai_api_key,
        temperature=settings.llm_temperature,
        # Timeout + retry để không treo vô hạn khi OpenAI chậm/lỗi mạng.
        timeout=settings.llm_request_timeout,
        max_retries=settings.llm_max_retries,
    )


def _history_block(history: list[dict] | None) -> str:
    if not history:
        return ""
    lines = []
    for msg in history:
        who = "Người dùng" if msg.get("role") == "user" else "Trợ lý"
        lines.append(f"{who}: {msg.get('content', '')}")
    return "\n".join(lines)


def needs_diacritic_restore(text: str) -> bool:
    """Câu tiếng Việt gõ KHÔNG DẤU (>=2 từ đặc trưng, không có ký tự có dấu) —
    embedding khớp kém với tài liệu có dấu → nên khôi phục dấu trước khi truy hồi."""
    if _VIETNAMESE_CHARS_RE.search(text or ""):
        return False
    tokens = re.findall(r"[a-z]+", (text or "").lower())
    return sum(1 for t in tokens if t in _VI_ASCII_WORDS) >= 2


_RESTORE_PROMPT = (
    "Viết lại câu sau thành tiếng Việt CÓ DẤU chuẩn, giữ nguyên thuật ngữ tiếng "
    "Anh/tên riêng, không thêm bớt ý. CHỈ trả về câu đã viết lại.\n\nCâu: {q}"
)


async def restore_diacritics(question: str) -> str:
    """Khôi phục dấu cho câu không dấu (dùng làm SEARCH QUERY; câu gốc giữ nguyên).

    Soft-fail: lỗi LLM → trả câu gốc, không chặn luồng."""
    from langchain_core.messages import HumanMessage

    try:
        response = await get_llm().ainvoke(
            [HumanMessage(content=_RESTORE_PROMPT.format(q=question))]
        )
        restored = str(response.content).strip().strip('"')
        # Kết quả hợp lệ phải CÓ dấu và không dài bất thường (LLM lan man).
        if restored and _VIETNAMESE_CHARS_RE.search(restored) and len(restored) < len(question) * 3 + 20:
            return restored
    except Exception:  # noqa: BLE001
        pass
    return question


async def contextualize_query(question: str, history: list[dict] | None) -> str:
    """Viết lại câu hỏi follow-up thành câu hỏi độc lập để truy hồi chính xác."""
    if not history:
        return question
    from langchain_core.messages import HumanMessage, SystemMessage

    messages = [
        SystemMessage(content=CONTEXTUALIZE_PROMPT),
        HumanMessage(
            content=f"LỊCH SỬ:\n{_history_block(history)}\n\nCÂU HỎI MỚI:\n{question}"
        ),
    ]
    try:
        response = await get_llm().ainvoke(messages)
        rewritten = str(response.content).strip()
        return rewritten or question
    except Exception:
        return question  # rewrite lỗi → dùng câu gốc, không chặn luồng


def build_context(context_chunks: list[dict], *, max_tokens: int, model_name: str) -> str:
    """Ghép các chunk thành CONTEXT, cắt theo ngân sách token để không vượt giới hạn."""
    encoding = _encoding(model_name)
    parts: list[str] = []
    used = 0
    for index, chunk in enumerate(context_chunks, start=1):
        title = chunk.get("title", "Unknown document")
        page = chunk.get("page_number", "N/A")
        section = chunk.get("section_title")
        header = f"[{index}] {title}"
        if section:
            header += f' - Mục: "{section}"'
        # Nguồn video YouTube: ghi mốc thời gian thay cho số trang.
        if chunk.get("timestamp"):
            header += f" - video tại {chunk['timestamp']}"
        elif page not in (None, "N/A"):
            header += f" - trang {page}"
        part = f"{header}\n{chunk.get('content', '')}"

        part_tokens = len(encoding.encode(part))
        if used + part_tokens > max_tokens:
            if not parts:
                # Chunk đầu tiên đã vượt: cắt cứng theo token để vẫn có ngữ cảnh.
                truncated = encoding.decode(encoding.encode(part)[:max_tokens])
                parts.append(truncated)
            break
        parts.append(part)
        used += part_tokens
    return "\n\n".join(parts)


def _doc_info_block(doc_info: dict | None) -> str:
    """Khối THÔNG TIN TÀI LIỆU (metadata thật từ DB) — chống bịa số trang/loại tệp."""
    if not doc_info:
        return ""
    lines = []
    for info in doc_info.values():
        ftype = (info.get("file_type") or "").upper() or "?"
        pages = info.get("total_pages") or 0
        chunks = info.get("total_chunks") or 0
        # Số trang KHÔNG đáng tin (dữ liệu cũ ghi 1 trang cho tài liệu rất nhiều đoạn)
        # → bỏ qua, để chatbot nói "chưa ghi nhận" thay vì trả lời sai.
        pages_reliable = pages >= 2 or (pages == 1 and chunks <= 10)
        detail = f"loại {ftype}, {chunks} đoạn đã lập chỉ mục (số trang chưa được ghi nhận)"
        if pages and pages_reliable:
            detail = f"loại {ftype}, tổng cộng {pages} trang, {chunks} đoạn đã lập chỉ mục"
        lines.append(f"- 『{info.get('title', '?')}』— {detail}")
    return (
        "THÔNG TIN TÀI LIỆU (metadata chính xác từ hệ thống — dùng cho câu hỏi về số "
        "trang/loại tài liệu):\n" + "\n".join(lines) + "\n\n"
    )


def _build_messages(
    question: str,
    context_chunks: list[dict],
    history: list[dict] | None,
    doc_info: dict | None = None,
):
    from langchain_core.messages import HumanMessage, SystemMessage

    settings = get_settings()
    if context_chunks:
        context = build_context(
            context_chunks,
            max_tokens=settings.rag_max_context_tokens,
            model_name=settings.model_name,
        )
    else:
        # Không có đoạn tài liệu liên quan: vẫn để LLM xử lý (chào hỏi xã giao →
        # trả lời thân thiện; câu hỏi tài liệu → báo không đủ dữ liệu theo quy tắc).
        context = "(Không có đoạn tài liệu nào liên quan đến câu hỏi.)"

    history_block = _history_block(history)
    history_part = f"LỊCH SỬ HỘI THOẠI (tham khảo để hiểu ngữ cảnh):\n{history_block}\n\n" if history_block else ""

    return [
        SystemMessage(content=build_system_prompt()),
        HumanMessage(
            content=(
                f"{history_part}"
                f"CÂU HỎI:\n{question}\n\n"
                f"{_doc_info_block(doc_info)}"
                f"CONTEXT (các đoạn trích từ tài liệu, kèm số nguồn):\n{context}\n\n"
                "Hãy trả lời theo đúng quy tắc ở trên."
                # Chỉ thị ngôn ngữ đặt CUỐI CÙNG để ép model trả lời đúng tiếng câu hỏi.
                f"{_language_directive(question)}"
            )
        ),
    ]


async def generate_answer(
    question: str,
    context_chunks: list[dict],
    history: list[dict] | None = None,
    doc_info: dict | None = None,
) -> str:
    messages = _build_messages(question, context_chunks, history, doc_info)
    response = await get_llm().ainvoke(messages)
    return str(response.content)


def count_text_tokens(text: str, model_name: str | None = None) -> int:
    """Đếm số token của một chuỗi văn bản."""
    if not text:
        return 0
    encoding = _encoding(model_name or get_settings().model_name)
    try:
        return len(encoding.encode(text))
    except Exception:
        return max(1, len(text) // 4)


def count_messages_tokens(messages: list, model_name: str | None = None) -> int:
    """Đếm tổng token của danh sách LangChain messages."""
    total = 0
    for m in messages:
        content = getattr(m, "content", "")
        if isinstance(content, str):
            total += count_text_tokens(content, model_name)
        elif isinstance(content, list):
            for part in content:
                if isinstance(part, dict) and "text" in part:
                    total += count_text_tokens(part["text"], model_name)
    return total
