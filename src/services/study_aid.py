from __future__ import annotations

import json
import re
from typing import Any

from fastapi import HTTPException
from langchain_core.messages import HumanMessage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Document, DocumentChunk, Flashcard, LearningEvaluation, Quiz, UserQuizAttempt
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

EVALUATION_PROMPT = """Bạn là chuyên gia cố vấn học tập AI và đánh giá năng lực giáo dục (Adaptive Learning & Competency Evaluation).
Dưới đây là kết quả làm bài trắc nghiệm của sinh viên:
- Tiêu đề đề thi / bài tập: {quiz_title}
- Môn học / Tài liệu liên quan: {document_title}
- Điểm số: {score}/10 (Đúng {correct_count}/{total_questions} câu)

DANH SÁCH CHI TIẾT TỪNG CÂU HỎI VÀ KẾT QUẢ:
{questions_summary}

NHIỆM VỤ CỦA BẠN:
Hãy phân tích sâu bài làm của sinh viên để đánh giá năng lực, xác định điểm mạnh, điểm yếu cốt lõi và vạch ra lộ trình học tập cá nhân hóa 3-4 bước nhằm khắc phục lỗ hổng kiến thức.

YÊU CẦU ĐẦU RA:
BẮT BUỘC là một JSON Object hợp lệ duy nhất, theo cấu trúc:
{{
  "competency_level": "Xuất sắc" hoặc "Khá Giỏi" hoặc "Đạt yêu cầu" hoặc "Cần củng cố",
  "summary": "Đoạn văn 2-3 câu nhận xét tổng quan năng lực sinh viên, thái độ học tập và mức độ thông hiểu bản chất môn học.",
  "strengths": [
    {{
      "topic": "Tên chủ đề / khái niệm làm tốt",
      "description": "Mô tả ngắn gọn sinh viên đã nắm chắc phần này như thế nào căn cứ vào các câu trả lời đúng."
    }}
  ],
  "weaknesses": [
    {{
      "topic": "Tên chủ đề / khái niệm bị hổng hoặc nhầm lẫn",
      "issue": "Chỉ rõ sinh viên nhầm lẫn ở điểm nào, tại sao chọn sai phương án",
      "advice": "Lời khuyên sư phạm ngắn gọn để ghi nhớ đúng",
      "failed_questions": [1, 3]
    }}
  ],
  "roadmap": [
    {{
      "step": 1,
      "title": "Tiêu đề bước (VD: Đọc lại lý thuyết về...)",
      "description": "Nội dung cần ôn tập chi tiết, chỉ rõ tài liệu hoặc phần cần xem lại",
      "action_type": "read",
      "document_title": "{document_title}"
    }},
    {{
      "step": 2,
      "title": "Luyện tập củng cố với Flashcards",
      "description": "Luyện tập các thẻ ghi nhớ thuật ngữ trọng tâm để khắc sâu kiến thức",
      "action_type": "flashcard",
      "document_title": "{document_title}"
    }},
    {{
      "step": 3,
      "title": "Làm lại bài kiểm tra ngắn khắc phục điểm yếu",
      "description": "Làm bài kiểm tra bù 3-5 câu để kiểm tra lại các phần vừa ôn",
      "action_type": "quiz",
      "document_title": "{document_title}"
    }}
  ]
}}
TUYỆT ĐỐI không thêm bất kỳ văn bản, ghi chú hay markdown nào ngoài JSON này.
"""


def _generate_fallback_evaluation(
    *,
    quiz_title: str,
    document_title: str,
    score: float,
    correct_count: int,
    total_questions: int,
    details: list[dict[str, Any]],
    document_id: str | None = None,
) -> dict[str, Any]:
    """Tạo bản đánh giá quy tắc dự phòng khi LLM không khả dụng hoặc lỗi."""
    failed_items = [d for d in details if not d["is_correct"]]
    correct_items = [d for d in details if d["is_correct"]]

    if score >= 8.5:
        level = "Xuất sắc"
        summary = f"Sinh viên thể hiện sự hiểu biết sâu sắc và toàn diện về bài học '{quiz_title}'. Khả năng phân tích và ghi nhớ kiến thức rất tốt, đạt điểm số ấn tượng {score}/10."
    elif score >= 7.0:
        level = "Khá Giỏi"
        summary = f"Sinh viên nắm vững đa số các kiến thức nền tảng của bài học '{quiz_title}' (đạt {score}/10). Tuy nhiên vẫn còn một vài điểm cần lưu ý để đạt mức độ xuất sắc."
    elif score >= 5.0:
        level = "Đạt yêu cầu"
        summary = f"Sinh viên đã đạt chuẩn đầu ra tối thiểu ({score}/10) cho bài học '{quiz_title}', nhưng còn một số khoảng trống kiến thức quan trọng cần được ôn luyện bổ sung."
    else:
        level = "Cần củng cố"
        summary = f"Kết quả bài kiểm tra '{quiz_title}' ({score}/10) cho thấy sinh viên chưa nắm chắc các nội dung cốt lõi. Cần nhanh chóng rà soát lại tài liệu và làm lại bài luyện tập."

    # Xây dựng Điểm mạnh
    strengths = []
    if correct_items:
        topics_sample = [d["question_text"][:40] + "..." for d in correct_items[:3]]
        strengths.append({
            "topic": "Nền tảng kiến thức trọng tâm",
            "description": f"Trả lời chính xác {len(correct_items)}/{total_questions} câu hỏi, đặc biệt là các nội dung: {'; '.join(topics_sample)}",
        })
    else:
        strengths.append({
            "topic": "Tinh thần tự học & hoàn thành bài thi",
            "description": "Đã kiên trì làm và hoàn thành bài kiểm tra, tạo cơ sở xác định đúng các phần kiến thức cần tập trung bổ sung.",
        })

    # Xây dựng Điểm yếu
    weaknesses = []
    if failed_items:
        for idx, item in enumerate(failed_items[:3], start=1):
            q_idx = item.get("question_index", idx)
            weaknesses.append({
                "topic": f"Kiến thức câu hỏi {q_idx}",
                "issue": f"Chưa chọn đúng phương án câu: '{item['question_text'][:60]}...'",
                "advice": item.get("explanation") or "Đọc lại phần giải thích và đối chiếu với giáo trình để hiểu rõ nguyên nhân chọn sai.",
                "failed_questions": [q_idx],
            })
    else:
        weaknesses.append({
            "topic": "Duy trì phong độ",
            "issue": "Không có lỗ hổng kiến thức rõ rệt trong bài thi này.",
            "advice": "Tiếp tục thử sức với các bài thi nâng cao và đề tài mới.",
            "failed_questions": [],
        })

    # Xây dựng Lộ trình
    roadmap = [
        {
            "step": 1,
            "title": f"Ôn tập lại giáo trình '{document_title}'",
            "description": f"Đọc kỹ lại các chương lý thuyết liên quan đến {len(failed_items)} câu hỏi đã chọn sai.",
            "action_type": "read",
            "document_id": document_id,
            "document_title": document_title,
        },
        {
            "step": 2,
            "title": "Ôn luyện thẻ ghi nhớ Flashcard",
            "description": "Luyện tập các thuật ngữ và định nghĩa quan trọng bằng phương pháp Active Recall.",
            "action_type": "flashcard",
            "document_id": document_id,
            "document_title": document_title,
        },
        {
            "step": 3,
            "title": "Làm lại bài kiểm tra bù kiến thức",
            "description": "Thực hiện lại bài kiểm tra để tự đánh giá mức độ tiến bộ sau khi đã ôn tập.",
            "action_type": "quiz",
            "document_id": document_id,
            "document_title": document_title,
        },
    ]

    return {
        "competency_level": level,
        "summary": summary,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "roadmap": roadmap,
    }


async def generate_learning_evaluation(
    session: AsyncSession,
    *,
    attempt_id: str,
    student_id: str,
) -> dict[str, Any]:
    """Sinh đánh giá năng lực học tập, điểm mạnh/yếu và lộ trình từ lượt làm bài quiz."""
    attempt = await session.get(UserQuizAttempt, attempt_id)
    if not attempt or attempt.student_id != student_id:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài làm trắc nghiệm tương ứng.")

    # Kiểm tra xem đã có đánh giá được tạo trước đó chưa
    existing = await study_aid_repo.get_evaluation_by_attempt(session, attempt_id)
    if existing:
        return {
            "id": existing.id,
            "user_id": existing.user_id,
            "quiz_id": existing.quiz_id,
            "attempt_id": existing.attempt_id,
            "score": existing.score,
            "competency_level": existing.competency_level,
            "summary": existing.summary,
            "strengths": existing.strengths,
            "weaknesses": existing.weaknesses,
            "roadmap": existing.roadmap,
            "created_at": existing.created_at,
        }

    quiz = await study_aid_repo.get_quiz(session, attempt.quiz_id, load_questions=True)
    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài Quiz gốc.")

    doc_title = quiz.title
    document_id = quiz.document_id
    if quiz.document_id:
        doc = await document_repo.get_document(session, quiz.document_id)
        if doc and doc.title:
            doc_title = doc.title

    user_answers = attempt.answers or {}
    total_questions = len(quiz.questions)
    correct_count = 0
    details = []

    lines_summary = []
    for idx, q in enumerate(quiz.questions, start=1):
        chosen = user_answers.get(q.id) or user_answers.get(str(q.id))
        is_corr = _answers_match(chosen, q.correct_answer)
        if is_corr:
            correct_count += 1
        details.append({
            "question_index": idx,
            "question_id": q.id,
            "question_text": q.question_text,
            "chosen_answer": chosen,
            "correct_answer": q.correct_answer,
            "is_correct": is_corr,
            "explanation": q.explanation or "",
        })
        lines_summary.append(
            f"Câu {idx}: {q.question_text}\n"
            f"- Phương án sinh viên chọn: {chosen or 'Chưa trả lời'}\n"
            f"- Đáp án đúng: {q.correct_answer}\n"
            f"- Kết quả: {'ĐÚNG' if is_corr else 'SAI'}\n"
            f"- Giải thích: {q.explanation or 'Không có'}"
        )

    questions_summary_str = "\n\n".join(lines_summary)

    # Thử gọi LLM phân tích sâu
    eval_data = None
    try:
        llm = get_llm(temperature=0.3)
        prompt = EVALUATION_PROMPT.format(
            quiz_title=quiz.title,
            document_title=doc_title,
            score=attempt.score,
            correct_count=correct_count,
            total_questions=total_questions,
            questions_summary=questions_summary_str,
        )
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        parsed = _extract_json(response.content)
        if isinstance(parsed, dict) and "strengths" in parsed and "weaknesses" in parsed:
            eval_data = parsed
    except Exception as exc:
        print(f"[study_aid] LLM evaluation error: {exc}")

    # Fallback nếu LLM không trả về đúng định dạng
    if not eval_data:
        eval_data = _generate_fallback_evaluation(
            quiz_title=quiz.title,
            document_title=doc_title,
            score=attempt.score,
            correct_count=correct_count,
            total_questions=total_questions,
            details=details,
            document_id=document_id,
        )

    # Đảm bảo cấu trúc roadmap có đủ document_id nếu có
    for step in eval_data.get("roadmap", []):
        if document_id and not step.get("document_id"):
            step["document_id"] = document_id
        if not step.get("document_title"):
            step["document_title"] = doc_title

    evaluation = await study_aid_repo.create_learning_evaluation(
        session,
        user_id=student_id,
        quiz_id=quiz.id,
        attempt_id=attempt.id,
        score=attempt.score,
        competency_level=eval_data.get("competency_level", "Đạt yêu cầu"),
        summary=eval_data.get("summary", ""),
        strengths=eval_data.get("strengths", []),
        weaknesses=eval_data.get("weaknesses", []),
        roadmap=eval_data.get("roadmap", []),
    )
    await session.commit()

    return {
        "id": evaluation.id,
        "user_id": evaluation.user_id,
        "quiz_id": evaluation.quiz_id,
        "attempt_id": evaluation.attempt_id,
        "score": evaluation.score,
        "competency_level": evaluation.competency_level,
        "summary": evaluation.summary,
        "strengths": evaluation.strengths,
        "weaknesses": evaluation.weaknesses,
        "roadmap": evaluation.roadmap,
        "created_at": evaluation.created_at,
    }


async def get_attempt_evaluation(
    session: AsyncSession,
    *,
    attempt_id: str,
    student_id: str,
) -> dict[str, Any] | None:
    """Lấy bản đánh giá năng lực của một lượt làm bài thi."""
    attempt = await session.get(UserQuizAttempt, attempt_id)
    if not attempt or attempt.student_id != student_id:
        return None

    evaluation = await study_aid_repo.get_evaluation_by_attempt(session, attempt_id)
    if not evaluation:
        return None

    return {
        "id": evaluation.id,
        "user_id": evaluation.user_id,
        "quiz_id": evaluation.quiz_id,
        "attempt_id": evaluation.attempt_id,
        "score": evaluation.score,
        "competency_level": evaluation.competency_level,
        "summary": evaluation.summary,
        "strengths": evaluation.strengths,
        "weaknesses": evaluation.weaknesses,
        "roadmap": evaluation.roadmap,
        "created_at": evaluation.created_at,
    }



async def get_attempt_review(
    session: AsyncSession,
    *,
    attempt_id: str,
    user_id: str,
    role: str = "student",
) -> dict[str, Any]:
    """Lay chi tiet bai thi da nop: diem so, cau hoi, cau tra loi cua thi sinh va dap an/loi giai."""
    result = await session.execute(
        select(UserQuizAttempt)
        .options(selectinload(UserQuizAttempt.quiz).selectinload(Quiz.questions))
        .where(UserQuizAttempt.id == attempt_id)
    )
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Không tìm thấy lượt làm bài thi.")

    if role not in ("admin", "lecturer") and attempt.student_id != user_id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xem lại bài thi này.")

    quiz = attempt.quiz
    answers = attempt.answers or {}
    total_questions = len(quiz.questions) if quiz and quiz.questions else 0
    correct_count = 0
    details = []

    if quiz and quiz.questions:
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

    return {
        "attempt_id": attempt.id,
        "quiz_id": quiz.id if quiz else "",
        "quiz_title": quiz.title if quiz else "Đề thi trắc nghiệm",
        "score": attempt.score,
        "total_questions": total_questions,
        "correct_count": correct_count,
        "completed_at": attempt.completed_at,
        "details": details,
    }
