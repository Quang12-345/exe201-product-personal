from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class FlashcardItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str
    front_text: str
    back_text: str
    created_at: datetime


class FlashcardCreate(BaseModel):
    front_text: str = Field(..., min_length=1, max_length=2000, description="Mặt trước flashcard (khái niệm / câu hỏi)")
    back_text: str = Field(..., min_length=1, max_length=4000, description="Mặt sau flashcard (định nghĩa / câu trả lời)")


class GenerateFlashcardsRequest(BaseModel):
    count: int = Field(default=10, ge=1, le=30, description="Số lượng thẻ flashcard muốn AI sinh")


class QuizQuestionItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    quiz_id: str
    question_text: str
    options: list[str]
    correct_answer: str | None = None
    explanation: str | None = None


class QuizQuestionCreate(BaseModel):
    question_text: str = Field(..., min_length=1)
    options: list[str] = Field(..., min_length=2, max_length=6)
    correct_answer: str = Field(..., min_length=1)
    explanation: str | None = None


class QuizItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str
    title: str
    created_at: datetime
    questions: list[QuizQuestionItem] = []


class QuizSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str
    title: str
    created_at: datetime
    question_count: int = 0


class GenerateQuizRequest(BaseModel):
    title: str | None = Field(default=None, max_length=255, description="Tiêu đề bài trắc nghiệm (để trống AI tự đặt)")
    num_questions: int = Field(default=5, ge=1, le=20, description="Số lượng câu hỏi trắc nghiệm")


class QuizSubmitRequest(BaseModel):
    answers: dict[str, str] = Field(
        ...,
        description="Bản đồ các câu trả lời dạng {question_id: chosen_option}",
    )


class QuizSubmitDetail(BaseModel):
    question_id: str
    question_text: str
    chosen_answer: str | None
    correct_answer: str
    is_correct: bool
    explanation: str | None = None


class QuizSubmitResponse(BaseModel):
    attempt_id: str
    quiz_id: str
    score: float
    total_questions: int
    correct_count: int
    completed_at: datetime
    details: list[QuizSubmitDetail]


class UserQuizAttemptItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    quiz_id: str
    student_id: str
    score: float
    completed_at: datetime
    answers: dict[str, Any] | None = None


class RecentSubmissionItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    student_id: str
    student_name: str
    student_email: str
    quiz_id: str
    quiz_title: str
    score: float
    total_questions: int | None = None
    score_display: str
    completed_at: datetime
    classroom_id: str | None = None
    classroom_name: str | None = None

