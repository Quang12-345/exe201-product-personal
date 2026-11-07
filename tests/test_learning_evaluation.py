import pytest
from src.services.study_aid import _generate_fallback_evaluation


def test_fallback_evaluation_high_score():
    details = [
        {"question_index": 1, "question_text": "Câu hỏi 1?", "is_correct": True, "explanation": "Giải thích 1"},
        {"question_index": 2, "question_text": "Câu hỏi 2?", "is_correct": True, "explanation": "Giải thích 2"},
    ]
    res = _generate_fallback_evaluation(
        quiz_title="Kiểm tra Triết học",
        document_title="Giáo trình Triết học.pdf",
        score=10.0,
        correct_count=2,
        total_questions=2,
        details=details,
        document_id="doc-123",
    )
    assert res["competency_level"] == "Xuất sắc"
    assert len(res["strengths"]) > 0
    assert len(res["roadmap"]) == 3
    assert res["roadmap"][0]["action_type"] == "read"


def test_fallback_evaluation_with_weaknesses():
    details = [
        {"question_index": 1, "question_text": "Quy luật mâu thuẫn là gì?", "is_correct": False, "explanation": "Mâu thuẫn biện chứng"},
        {"question_index": 2, "question_text": "Định nghĩa vật chất là gì?", "is_correct": True, "explanation": "Vật chất là thực tại khách quan"},
    ]
    res = _generate_fallback_evaluation(
        quiz_title="Kiểm tra Triết học",
        document_title="Giáo trình Triết học.pdf",
        score=5.0,
        correct_count=1,
        total_questions=2,
        details=details,
        document_id="doc-123",
    )
    assert res["competency_level"] == "Đạt yêu cầu"
    assert len(res["weaknesses"]) > 0
    assert 1 in res["weaknesses"][0]["failed_questions"]
    assert len(res["roadmap"]) == 3
