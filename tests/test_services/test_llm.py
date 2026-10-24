from src.services.llm import _build_messages, build_context, detect_question_language


def _chunk(title, content, page=1, section=None):
    return {"title": title, "content": content, "page_number": page, "section_title": section}


def test_detect_question_language_vietnamese():
    assert detect_question_language("deep learning là gì") == "vi"
    assert detect_question_language("Quy định đào tạo đại học là gì?") == "vi"


def test_detect_question_language_english():
    assert detect_question_language("what is deep learning") == "en"
    assert detect_question_language("Explain federated learning briefly.") == "en"


def test_build_messages_injects_english_directive_for_english_question():
    messages = _build_messages("what is deep learning", [_chunk("Doc", "Nội dung tiếng Việt")], None)
    human = messages[-1].content
    assert "ENGLISH" in human and "Do NOT reply in Vietnamese" in human
    # Chỉ thị ngôn ngữ phải nằm CUỐI message để có trọng số cao nhất.
    assert human.rstrip().endswith("Do NOT reply in Vietnamese.")


def test_build_messages_injects_vietnamese_directive_for_vietnamese_question():
    messages = _build_messages("deep learning là gì", [_chunk("Doc", "English content")], None)
    human = messages[-1].content
    assert "TIẾNG VIỆT" in human and "Không trả lời bằng tiếng Anh" in human


def test_build_context_includes_header_and_citation_index():
    chunks = [_chunk("Doc A", "Nội dung A", page=3, section="Giới thiệu")]
    context = build_context(chunks, max_tokens=1000, model_name="gpt-4o-mini")
    assert "[1] Doc A" in context
    assert 'Mục: "Giới thiệu"' in context
    assert "trang 3" in context
    assert "Nội dung A" in context


def test_build_context_respects_token_budget():
    # Hai chunk dài, ngân sách nhỏ → chỉ chunk đầu được giữ.
    chunks = [
        _chunk("Doc A", "alpha " * 200),
        _chunk("Doc B", "beta " * 200),
    ]
    context = build_context(chunks, max_tokens=60, model_name="gpt-4o-mini")
    assert "[1] Doc A" in context
    assert "[2] Doc B" not in context


def test_build_context_truncates_when_first_chunk_too_large():
    chunks = [_chunk("Doc A", "word " * 500)]
    context = build_context(chunks, max_tokens=50, model_name="gpt-4o-mini")
    assert context  # vẫn có nội dung (đã cắt cứng), không rỗng
