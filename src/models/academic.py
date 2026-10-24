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
    subject: str = Field(min_length=1, max_length=255)
    title: str = Field(min_length=1, max_length=255)
    exam_date: datetime | None = None
    room: str | None = None
    duration_minutes: int = Field(default=0, ge=0)
    note: str | None = None


class ExamUpdate(BaseModel):
    subject: str | None = Field(default=None, max_length=255)
    title: str | None = Field(default=None, max_length=255)
    exam_date: datetime | None = None
    room: str | None = None
    duration_minutes: int | None = Field(default=None, ge=0)
    note: str | None = None


class ExamResponse(BaseModel):
    id: str
    subject: str
    title: str
    exam_date: datetime | None = None
    room: str | None = None
    duration_minutes: int = 0
    note: str | None = None
    created_by: str | None = None
    created_at: datetime | None = None
