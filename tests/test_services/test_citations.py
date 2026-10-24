from src.services.citations import cited_indexes, select_cited_sources


def _sources(n):
    return [
        {"chunk_id": f"c{i}", "title": f"Doc {i}", "page_number": i, "score": 0.5}
        for i in range(1, n + 1)
    ]


def test_cited_indexes_parses_bracket_numbers():
    assert cited_indexes("Theo [1] và [3], điều này đúng.") == {1, 3}


def test_select_keeps_only_cited_sources():
    sources = _sources(3)
    # Câu trả lời chỉ trích dẫn [1] → bỏ [2][3] thừa.
    result = select_cited_sources("Trả lời dựa trên [1].", sources)
    assert len(result) == 1
    assert result[0]["chunk_id"] == "c1"
    assert result[0]["cite"] == 1


def test_select_preserves_original_citation_numbers():
    sources = _sources(4)
    result = select_cited_sources("Xem [1] và [4].", sources)
    assert [s["cite"] for s in result] == [1, 4]


def test_select_returns_empty_when_no_citation():
    # Lời chào / đáp xã giao ngắn không trích dẫn → không hiển thị nguồn.
    assert select_cited_sources("Xin chào! Bạn cần hỏi gì?", _sources(3)) == []


# ---- Cơ chế dự phòng: đảm bảo CÓ nguồn cho cả student & lecturer khi trả lời từ
#      tài liệu nhưng mô hình quên chèn [n]. ----

_LONG_ANSWER = (
    "Học sâu là một nhánh của học máy sử dụng mạng nơ-ron nhiều lớp để học từ dữ "
    "liệu. Nó được ứng dụng rộng rãi trong nhận diện hình ảnh, xử lý ngôn ngữ tự "
    "nhiên và nhiều bài toán trí tuệ nhân tạo khác, mang lại kết quả vượt trội so "
    "với các phương pháp truyền thống trong nhiều lĩnh vực."
)


def test_select_fallback_attaches_sources_when_grounded_but_uncited():
    # Câu trả lời dài, dựa trên tài liệu nhưng KHÔNG có [n] → vẫn đính kèm nguồn.
    result = select_cited_sources(_LONG_ANSWER, _sources(3))
    assert len(result) == 3
    assert [s["cite"] for s in result] == [1, 2, 3]


def test_select_fallback_capped_and_only_confident():
    sources = [
        {"chunk_id": "c1", "title": "Doc 1", "page_number": 1, "score": 0.6},
        {"chunk_id": "c2", "title": "Doc 2", "page_number": 2, "score": 0.5},
        {"chunk_id": "c3", "title": "Doc 3", "page_number": 3, "score": 0.45},
        {"chunk_id": "c4", "title": "Doc 4", "page_number": 4, "score": 0.25},  # dưới ngưỡng
    ]
    result = select_cited_sources(_LONG_ANSWER, sources)
    # Tối đa 3 nguồn, và loại nguồn điểm thấp (0.25 < rag_min_score).
    assert len(result) == 3
    assert {s["chunk_id"] for s in result} == {"c1", "c2", "c3"}


def test_select_fallback_skipped_for_no_data_answer():
    # Câu "không đủ dữ liệu" dù dài cũng KHÔNG gắn nguồn.
    no_data = "Rất tiếc, " + "tài liệu hiện có chưa đề cập nội dung này. " * 5
    assert select_cited_sources(no_data, _sources(3)) == []


def test_select_fallback_skipped_when_no_confident_source():
    weak = [{"chunk_id": "c1", "title": "Doc 1", "page_number": 1, "score": 0.2}]
    assert select_cited_sources(_LONG_ANSWER, weak) == []
