from src.services.citations import is_smalltalk, select_cited_sources


def _sources(*scores):
    return [{"score": s, "title": "doc", "chunk_id": str(i)} for i, s in enumerate(scores)]


def test_smalltalk_detection():
    assert is_smalltalk("xin chào") is True
    assert is_smalltalk("chao ban") is True
    assert is_smalltalk("Hello!") is True
    assert is_smalltalk("cảm ơn") is True
    assert is_smalltalk("bạn là ai") is True
    assert is_smalltalk("ban dung model nao") is True
    # Câu hỏi thật KHÔNG được coi là smalltalk
    assert is_smalltalk("quy chế đào tạo là gì") is False
    assert is_smalltalk("chào buổi sáng, cho mình hỏi về điểm thi và quy chế") is False
    assert is_smalltalk("deep learning la gi") is False


def test_pure_refusal_with_stray_citation_drops_sources():
    # LLM lỡ chèn [1] vào câu từ chối thuần → phải BỎ nguồn (mâu thuẫn logic).
    r = "Tài liệu hiện có chưa đề cập nội dung này [1]."
    assert select_cited_sources(r, _sources(0.6)) == []


def test_partial_answer_with_no_data_marker_keeps_sources():
    # Trả lời MỘT PHẦN (dài) chứa marker "chưa đề cập" → vẫn giữ nguồn hợp lệ.
    r = (
        "Theo quy chế, sinh viên cần tích lũy tối thiểu 120 tín chỉ và đạt điểm trung "
        "bình từ 2.0 trở lên để đủ điều kiện tốt nghiệp [1]. Ngoài ra cần hoàn thành "
        "các học phần bắt buộc theo chương trình đào tạo của từng ngành học [2]. "
        "Riêng phần lệ phí xét tốt nghiệp thì tài liệu chưa đề cập."
    )
    out = select_cited_sources(r, _sources(0.6, 0.55))
    assert [s["cite"] for s in out] == [1, 2]


def test_greeting_answer_no_sources():
    assert select_cited_sources("Xin chào! Mình có thể giúp gì?", _sources(0.7)) == []


def test_bm25_tokenize_folds_diacritics():
    from src.services.retrieval import tokenize

    # Câu không dấu phải khớp token với nội dung có dấu.
    assert tokenize("dieu kien tot nghiep la gi") == tokenize("điều kiện tốt nghiệp là gì")
    assert "hoc" in tokenize("Học sâu")


def test_needs_diacritic_restore():
    from src.services.llm import needs_diacritic_restore

    assert needs_diacritic_restore("dieu kien tot nghiep la gi") is True
    assert needs_diacritic_restore("deep learning la gi") is True
    # Có dấu rồi → không cần.
    assert needs_diacritic_restore("điều kiện tốt nghiệp là gì") is False
    # Tiếng Anh thật → không cần.
    assert needs_diacritic_restore("what is deep learning") is False
