from src.services.retrieval import hybrid_rerank, select_relevant_excerpt, tokenize


def test_tokenize_lowercases_and_splits_unicode():
    # tokenize giờ BỎ DẤU (diacritic folding) để câu không dấu khớp nội dung có dấu.
    assert tokenize("MECE là gì?") == ["mece", "la", "gi"]
    assert tokenize("MECE la gi?") == tokenize("MECE là gì?")


def test_hybrid_rerank_promotes_keyword_match():
    # Dense order đặt chunk khớp từ khóa ở cuối; BM25 phải kéo nó lên.
    candidates = [
        {"chunk_id": "a", "content": "tổng quan chung về học máy", "dense_score": 0.55},
        {"chunk_id": "b", "content": "khái niệm cơ bản nhập môn", "dense_score": 0.52},
        {"chunk_id": "c", "content": "thuật toán Gradient Descent tối ưu hàm mất mát", "dense_score": 0.50},
    ]
    reranked = hybrid_rerank("Gradient Descent là gì?", candidates)
    assert reranked[0]["chunk_id"] == "c"
    assert all("rrf_score" in c for c in reranked)


def test_hybrid_rerank_single_candidate_noop():
    candidates = [{"chunk_id": "a", "content": "x", "dense_score": 0.9}]
    assert hybrid_rerank("bất kỳ", candidates) == candidates


def test_hybrid_rerank_handles_empty_query():
    candidates = [
        {"chunk_id": "a", "content": "alpha", "dense_score": 0.6},
        {"chunk_id": "b", "content": "beta", "dense_score": 0.5},
    ]
    reranked = hybrid_rerank("", candidates)
    # Không có token query → giữ thứ tự dense (a trước b).
    assert [c["chunk_id"] for c in reranked] == ["a", "b"]


def test_select_relevant_excerpt_chooses_definition_for_what_is_question():
    content = (
        "Nhóm 2:\n\n"
        "Chủ đề: SẢN XUẤT HÀNG HÓA, HÀNG HÓA VÀ CÁC THUỘC TÍNH CỦA HÀNG HÓA\n\n"
        "Câu hỏi: Điều gì làm nên giá trị của một món hàng?\n\n"
        "Lời đáp gọn gàng: Giá trị của một món hàng được quyết định bởi thời gian lao động xã hội cần thiết.\n\n"
        "NỘI DUNG CHI TIẾT\n\n"
        "Phần 1: Khái niệm và hai điều kiện ra đời của sản xuất hàng hóa\n\n"
        "Khái niệm: Sản xuất hàng hóa là kiểu tổ chức hoạt động kinh tế mà ở đó "
        "những người sản xuất ra sản phẩm không phải để phục vụ tiêu dùng cho chính họ, "
        "mà là nhằm mục đích trao đổi, mua bán trên thị trường."
    )

    excerpt = select_relevant_excerpt(content, "sản xuất hàng hóa là gì")

    assert excerpt.startswith("Khái niệm: Sản xuất hàng hóa là kiểu")
    assert "Nhóm 2" not in excerpt
    assert "trao đổi, mua bán trên thị trường" in excerpt
