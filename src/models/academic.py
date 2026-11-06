"""Schemas cho domain học vụ: sinh viên + lịch thi (quản lý bởi giảng viên/quản trị)."""

from datetime import datetime

from pydantic import BaseModel, Field


class StudentCreate(BaseModel):
    student_code: str = Field(min_length=1, max_length=50)
    full_name: str = Field(min_length=1, max_length=255)
    subject: str = Field(min_length=1, max_length=255)
    email: str | None = None
    note: str | None = None


class StudentUpdate(BaseModel):
    student_code: str | None = Field(default=None, max_length=50)
    full_name: str | None = Field(default=None, max_length=255)
    subject: str | None = Field(default=None, max_length=255)
    email: str | None = None
    note: str | None = None


class StudentResponse(BaseModel):
    id: str
    student_code: str
    full_name: str
    subject: str
    email: str | None = None
    note: str | None = None
    created_by: str | None = None
    created_at: datetime | None = None


class ExamCreate(BaseModel):
    classroom_id: str | None = None
    subject: str = Field(min_length=1, max_length=255)
    title: str = Field(min_length=1, max_length=255)
    exam_date: datetime | None = None
    room: str | None = None
    duration_minutes: int = Field(default=0, ge=0)
    note: str | None = None
    document_id: str | None = None
    quiz_id: str | None = None


class ExamUpdate(BaseModel):
    classroom_id: str | None = None
    subject: str | None = Field(default=None, max_length=255)
    title: str | None = Field(default=None, max_length=255)
    exam_date: datetime | None = None
    room: str | None = None
    duration_minutes: int | None = Field(default=None, ge=0)
    note: str | None = None
    document_id: str | None = None
    quiz_id: str | None = None


class ExamResponse(BaseModel):
    id: str
    classroom_id: str | None = None
    classroom_name: str | None = None
    classroom_code: str | None = None
    subject: str
    title: str
    exam_date: datetime | None = None
    room: str | None = None
    duration_minutes: int = 0
    note: str | None = None
    created_by: str | None = None
    created_at: datetime | None = None
    document_id: str | None = None
    document_title: str | None = None
    document_file_name: str | None = None
    quiz_id: str | None = None
    quiz_title: str | None = None
    quiz_question_count: int | None = None


class ExamResourcesResponse(BaseModel):
    documents: list[dict]
    quizzes: list[dict]
