from src.services import confidence
from src.services.confidence import assess_answer


def _sources(*scores):
    return [{"score": s, "title": "doc", "chunk_id": str(i)} for i, s in enumerate(scores)]


def test_no_sources_no_citation():
    r = assess_answer("Tôi không tìm thấy thông tin.", [])
    assert r["grounded"] is False
    assert r["confidence"] == 0.1
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


def test_fully_covered_and_supported_answer_is_100_percent():
    result = assess_answer(
        "Đáp ứng đủ các ý [1].",
        _sources(0.36),
        coverage_review={
            "coverage": 1.0,
            "all_claims_supported": True,
            "covered_requirements": 2,
            "total_requirements": 2,
            "unsupported_claims": [],
        },
    )

    assert result["confidence"] == 1.0
    assert result["level"] == "cao"
    assert result["factors"]["assessment_method"] == "coverage"


def test_partial_coverage_reduces_confidence():
    result = assess_answer(
        "Chỉ trả lời một ý [1].",
        _sources(0.69),
        coverage_review={
            "coverage": 0.5,
            "all_claims_supported": True,
            "covered_requirements": 1,
            "total_requirements": 2,
            "unsupported_claims": [],
        },
    )

    assert result["confidence"] == 0.5


def test_unsupported_claim_reduces_confidence_even_when_all_parts_answered():
    result = assess_answer(
        "Trả lời đủ nhưng có thêm ý không có căn cứ [1].",
        _sources(0.69),
        coverage_review={
            "coverage": 1.0,
            "all_claims_supported": False,
            "covered_requirements": 2,
            "total_requirements": 2,
            "unsupported_claims": ["Thông tin bổ sung"],
        },
    )

    assert result["confidence"] == 0.75
    assert result["factors"]["unsupported_claims"] == 1


def test_sources_that_do_not_support_any_question_part_are_not_grounded():
    result = assess_answer(
        "Không đủ dữ liệu để trả lời.",
        _sources(0.69),
        coverage_review={
            "coverage": 0.0,
            "all_claims_supported": False,
            "covered_requirements": 0,
            "total_requirements": 2,
            "unsupported_claims": [],
        },
    )

    assert result["grounded"] is False
    assert result["confidence"] == 0.0


def test_coverage_evaluator_counts_only_answered_supported_requirements(monkeypatch):
    class FakeStructuredModel:
        def with_structured_output(self, schema):
            assert schema is confidence.CoverageReview
            return self

        async def ainvoke(self, messages):
            assert len(messages) == 2
            return confidence.CoverageReview(
                requirements=[
                    confidence.RequirementReview(
                        requirement="Ý thứ nhất", answered=True, supported=True
                    ),
                    confidence.RequirementReview(
                        requirement="Ý thứ hai", answered=False, supported=True
                    ),
                ],
                unsupported_claims=[],
            )

    monkeypatch.setattr(
        "src.services.llm.get_llm",
        lambda: FakeStructuredModel(),
    )
    monkeypatch.setattr(
        "src.config.get_settings",
        lambda: type(
            "Settings",
            (),
            {"llm_request_timeout": 2.0, "model_name": "gpt-4o-mini"},
        )(),
    )

    import asyncio

    result = asyncio.run(
        confidence.evaluate_answer_coverage(
            "Trả lời hai ý",
            "Trả lời ý đầu",
            [{"title": "Tài liệu", "content": "Nội dung có căn cứ"}],
        )
    )

    assert result["coverage"] == 0.5
    assert result["all_claims_supported"] is False
    assert result["covered_requirements"] == 1
    assert result["total_requirements"] == 2
