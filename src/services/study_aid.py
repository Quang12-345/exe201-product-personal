from __future__ import annotations

import json
import re
from typing import Any

from fastapi import HTTPException
from langchain_core.messages import HumanMessage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Document, DocumentChunk, Flashcard, Quiz
from src.repositories import document_repo, study_aid_repo
from src.services.llm import get_llm

_MAX_CONTEXT_CHARS = 12000

FLASHCARDS_PROMPT = """Bạn là chuyên gia giáo dục thiết kế tài liệu học tập chủ động (Active Recall).
Dựa vào nội dung tài liệu được cung cấp dưới đây, hãy trích xuất {count} thẻ flashcard quan trọng nhất.
Mỗi flashcard gồm:
- front_text: Thuật ngữ, câu hỏi hoặc khái niệm cốt lõi cần nhớ (mặt trước).
- back_text: Định nghĩa chính xác, câu trả lời súc tích, công thức hoặc cách áp dụng (mặt sau).

YÊU CẦU:
1. Bám sát nội dung tài liệu, KHÔNG bịa thông tin không có trong tài liệu.
2. Viết bằng ngôn ngữ chủ đạo của tài liệu (ưu tiên Tiếng Việt nếu tài liệu có Tiếng Việt).
3. ĐẦU RA BẮT BUỘC là một mảng JSON hợp lệ duy nhất:
[
  {{"front_text": "Khái niệm 1", "back_text": "Định nghĩa hoặc giải thích 1"}},
  {{"front_text": "Khái niệm 2", "back_text": "Định nghĩa hoặc giải thích 2"}}
]
TUYỆT ĐỐI không thêm bất kỳ văn bản, ghi chú hay markdown nào ngoài mảng JSON này.

NỘI DUNG TÀI LIỆU (Tựa đề: {title}):
{context}
"""

QUIZ_PROMPT = """Bạn là giảng viên soạn đề thi trắc nghiệm học thuật.
Dựa vào nội dung tài liệu sau, hãy soạn {num_questions} câu hỏi trắc nghiệm khách quan 4 lựa chọn (A, B, C, D).
Mỗi câu hỏi phải kiểm tra khả năng hiểu và ghi nhớ kiến thức từ tài liệu.

YÊU CẦU:
1. Mỗi câu hỏi gồm 4 phương án rõ ràng (bắt đầu bằng A., B., C., D.).
2. Chỉ có DUY NHẤT 1 phương án đúng.
3. correct_answer phải ghi đúng phương án đúng (ví dụ: "A. ..." hoặc "B. ...").
4. explanation: 1-2 câu giải thích ngắn gọn vì sao đáp án đó đúng căn cứ theo tài liệu.
5. ĐẦU RA BẮT BUỘC là một JSON Object hợp lệ duy nhất:
{{
  "title": "Tiêu đề bài trắc nghiệm (phù hợp với nội dung)",
  "questions": [
    {{
      "question_text": "Nội dung câu hỏi trắc nghiệm 1?",
      "options": ["A. Lựa chọn 1", "B. Lựa chọn 2", "C. Lựa chọn 3", "D. Lựa chọn 4"],
      "correct_answer": "A. Lựa chọn 1",
      "explanation": "Căn cứ theo tài liệu..."
    }}
  ]
}}
TUYỆT ĐỐI không thêm bất kỳ văn bản, ghi chú hay markdown nào ngoài JSON này.

NỘI DUNG TÀI LIỆU (Tựa đề: {title}):
{context}
"""


def _extract_json(text: str) -> Any:
    """Tách khối JSON sạch từ kết quả LLM sinh ra."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()

    # Thử parse trực tiếp
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # Tìm mảng JSON [...]
    array_match = re.search(r"\[.*\]", cleaned, re.DOTALL)
    if array_match:
        try:
            return json.loads(array_match.group(0))
        except Exception:
            pass

    # Tìm object JSON {...}
    obj_match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if obj_match:
        try:
            return json.loads(obj_match.group(0))
        except Exception:
            pass

    return None


async def get_document_context(
    session: AsyncSession, document_id: str
) -> tuple[Document, str]:
    document = await document_repo.get_document(session, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu.")

    # Lấy các chunk nội dung
    chunk_res = await session.execute(
        select(DocumentChunk.content)
        .where(DocumentChunk.document_id == document_id)
        .order_by(DocumentChunk.chunk_index.asc())
    )
    chunks = [row[0] for row in chunk_res.all()]
    context = "\n\n".join(chunks).strip()

    if not context:
        # Nếu chưa chunk hoặc là text tóm tắt
        context = str(document.title)

    return document, context[:_MAX_CONTEXT_CHARS]


async def generate_flashcards(
    session: AsyncSession,
    *,
    document_id: str,
    count: int = 10,
    user_id: str | None = None,
) -> list[Flashcard]:
    document, context = await get_document_context(session, document_id)
    prompt = FLASHCARDS_PROMPT.format(
        count=count,
        title=document.title,
        context=context,
    )

    llm = get_llm()
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    raw_content = str(response.content)

    parsed = _extract_json(raw_content)
    if not isinstance(parsed, list) or not parsed:
        raise HTTPException(
            status_code=500,
            detail="AI không thể tạo danh sách Flashcard hợp lệ từ tài liệu này.",
        )

    return await study_aid_repo.bulk_create_flashcards(
        session,
        document_id=document_id,
        items=parsed,
        user_id=user_id,
    )


async def generate_quiz(
    session: AsyncSession,
    *,
    document_id: str,
    title: str | None = None,
    num_questions: int = 5,
    user_id: str | None = None,
) -> Quiz:
    document, context = await get_document_context(session, document_id)
    prompt = QUIZ_PROMPT.format(
        num_questions=num_questions,
        title=document.title,
        context=context,
    )

    llm = get_llm()
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    raw_content = str(response.content)

    parsed = _extract_json(raw_content)
    if not isinstance(parsed, dict) or "questions" not in parsed:
        raise HTTPException(
            status_code=500,
            detail="AI không thể tạo bài trắc nghiệm hợp lệ từ tài liệu này.",
        )

    quiz_title = (title or "").strip() or str(parsed.get("title") or f"Trắc nghiệm: {document.title}")
    questions = parsed.get("questions") or []

    if not questions:
        raise HTTPException(
            status_code=500,
            detail="Không có câu hỏi nào được sinh ra từ tài liệu.",
        )

    return await study_aid_repo.create_quiz(
        session,
        document_id=document_id,
        title=quiz_title,
        questions=questions,
        user_id=user_id,
    )


def _answers_match(chosen: str | None, correct: str) -> bool:
    if not chosen:
        return False
    c = chosen.strip().lower()
    t = correct.strip().lower()
    if c == t:
        return True
    # Kiểm tra tiền tố A., B., C., D.
    c_letter = c[0] if len(c) > 0 and c[0] in "abcd" else ""
    t_letter = t[0] if len(t) > 0 and t[0] in "abcd" else ""
    if c_letter and t_letter and c_letter == t_letter:
        return True
    return False


async def evaluate_quiz_submission(
    session: AsyncSession,
    *,
    quiz_id: str,
    student_id: str,
    answers: dict[str, str],
) -> dict[str, Any]:
    quiz = await study_aid_repo.get_quiz(session, quiz_id, load_questions=True)
    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài Quiz.")

    total_questions = len(quiz.questions)
    if total_questions == 0:
        raise HTTPException(status_code=400, detail="Bài Quiz này không có câu hỏi nào.")

    correct_count = 0
    details = []

    for q in quiz.questions:
        chosen = answers.get(q.id) or answers.get(str(q.id))
        is_correct = _answers_match(chosen, q.correct_answer)
        if is_correct:
            correct_count += 1

        details.append(
            {
                "question_id": q.id,
                "question_text": q.question_text,
                "chosen_answer": chosen,
                "correct_answer": q.correct_answer,
                "is_correct": is_correct,
                "explanation": q.explanation,
            }
        )

    score = round((correct_count / total_questions) * 10, 2)

    attempt = await study_aid_repo.create_quiz_attempt(
        session,
        quiz_id=quiz_id,
        student_id=student_id,
        score=score,
        answers=answers,
    )

    return {
        "attempt_id": attempt.id,
        "quiz_id": quiz.id,
        "score": score,
        "total_questions": total_questions,
        "correct_count": correct_count,
        "completed_at": attempt.completed_at,
        "details": details,
    }
