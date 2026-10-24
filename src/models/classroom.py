"""Schemas cho domain Lớp học (Classrooms) và cô lập tài liệu theo lớp."""

from datetime import datetime

from pydantic import BaseModel, Field


class ClassroomCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255, description="Tên lớp học (VD: Lập trình C (Nhóm 01))")
    code: str | None = Field(default=None, max_length=50, description="Mã lớp học (VD: C_PROG_01). Tự sinh nếu để trống.")
    subject: str = Field(min_length=1, max_length=255, description="Môn học (VD: Lập trình C)")
    description: str | None = Field(default=None, max_length=500, description="Mô tả / ghi chú")


class ClassroomUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    code: str | None = Field(default=None, max_length=50)
    subject: str | None = Field(default=None, max_length=255)
    description: str | None = None


class ClassroomResponse(BaseModel):
    id: str
    name: str
    code: str
    subject: str
    description: str | None = None
    created_by: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    student_count: int = 0
    document_count: int = 0
    lecturer_name: str | None = None
    is_enrolled: bool | None = None


class AddStudentToClassroomRequest(BaseModel):
    student_code: str = Field(min_length=1, max_length=50)
    full_name: str = Field(min_length=1, max_length=255)
    email: str | None = None
    note: str | None = None


class JoinClassroomRequest(BaseModel):
    code: str = Field(min_length=1, max_length=50, description="Mã lớp học (VD: C_PROG_01)")
