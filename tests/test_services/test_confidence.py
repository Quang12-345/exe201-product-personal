from src.services.confidence import assess_answer


def _sources(*scores):
    return [{"score": s, "title": "doc", "chunk_id": str(i)} for i, s in enumerate(scores)]


def test_no_sources_no_citation():
    r = assess_answer("Tôi không tìm thấy thông tin.", [])
    assert r["grounded"] is False
    assert r["confidence"] <= 0.35
    assert r["level"] == "thấp"


def test_strong_answer_high_confidence():
    # Nhiều nguồn điểm cao + có trích dẫn [n] → tin cậy cao.
    r = assess_answer("Theo quy chế [1], cần 120 tín chỉ [2].", _sources(0.69, 0.62, 0.58))
    assert r["grounded"] is True
    assert r["confidence"] >= 0.68
    assert r["level"] == "cao"


def test_medium_answer():
    # 1 nguồn điểm vừa + có trích dẫn → trung bình.
    r = assess_answer("Câu trả lời [1].", _sources(0.46))
    assert r["level"] in ("trung bình", "thấp")
    assert 0.0 < r["confidence"] < 0.68


def test_filtered_sources_without_inline_citation_still_grounded():
    # `sources` là danh sách ĐÃ QUA LỌC (select_cited_sources) — có nguồn nghĩa là
    # câu trả lời dựa tài liệu, kể cả khi LLM quên chèn [n] (nguồn dự phòng).
    # KHÔNG được báo "không có nguồn" trong khi khối nguồn vẫn hiển thị (bug cũ).
    r = assess_answer("Một câu trả lời dựa tài liệu nhưng quên chèn chỉ số.", _sources(0.69, 0.65))
    assert r["grounded"] is True
    assert r["confidence"] > 0.35
    # Thiếu [n] inline → factor cited chỉ ở mức vừa (0.6), không phải 1.0.
    assert r["factors"]["cited"] == 0.6


def test_no_sources_capped():
    # Không còn nguồn nào sau lọc → không bám tài liệu, chặn trần 0.35.
    r = assess_answer("Câu trả lời chung chung.", [])
    assert r["grounded"] is False
    assert r["confidence"] <= 0.35


def test_factors_present():
    r = assess_answer("Trả lời [1].", _sources(0.6))
    f = r["factors"]
    assert f["n_sources"] == 1
    assert f["cited"] == 1.0
    assert 0.0 <= f["top_relevance"] <= 1.0


def test_calibration_monotonic():
    low = assess_answer("X [1].", _sources(0.40))["confidence"]
    high = assess_answer("X [1].", _sources(0.69))["confidence"]
    assert high > low
