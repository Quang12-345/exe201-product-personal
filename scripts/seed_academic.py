"""Seed dữ liệu học vụ mẫu: sinh viên + lịch thi cho giảng viên demo.

Gắn vào tài khoản lecturer@ai20k.vn (chạy seed_demo.py trước). Idempotent:
nếu giảng viên đã có sinh viên/lịch thi thì bỏ qua phần đó.

Usage:
    python scripts/seed_academic.py
"""

import asyncio
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from src.db.models import Exam, Student, User
from src.db.session import AsyncSessionLocal, init_db

LECTURER_EMAIL = "lecturer@ai20k.vn"

SUBJECTS = ["Công nghệ phần mềm", "Cơ sở dữ liệu"]

STUDENTS = [
    {"student_code": "SV2021001", "full_name": "Nguyễn Văn An", "subject": "Công nghệ phần mềm", "email": "an.nv@sv.ai20k.vn"},
    {"student_code": "SV2021002", "full_name": "Trần Thị Bình", "subject": "Công nghệ phần mềm", "email": "binh.tt@sv.ai20k.vn"},
    {"student_code": "SV2021003", "full_name": "Lê Hoàng Cường", "subject": "Công nghệ phần mềm", "email": "cuong.lh@sv.ai20k.vn"},
    {"student_code": "SV2021010", "full_name": "Phạm Thị Dung", "subject": "Cơ sở dữ liệu", "email": "dung.pt@sv.ai20k.vn"},
    {"student_code": "SV2021011", "full_name": "Vũ Minh Đức", "subject": "Cơ sở dữ liệu", "email": "duc.vm@sv.ai20k.vn"},
]


def _exam_specs() -> list[dict]:
    base = datetime.now().replace(hour=7, minute=30, second=0, microsecond=0) + timedelta(days=7)
    return [
        {"subject": "Công nghệ phần mềm", "title": "Thi cuối kỳ CNPM", "exam_date": base, "room": "P.301-A1", "duration_minutes": 90, "note": "Mang theo thẻ SV"},
        {"subject": "Cơ sở dữ liệu", "title": "Thi cuối kỳ CSDL", "exam_date": base + timedelta(days=2, hours=6), "room": "P.205-A2", "duration_minutes": 75, "note": "Được dùng 1 tờ A4"},
    ]


async def run() -> dict:
    await init_db()
    stats = {"students": 0, "exams": 0, "skipped": False}
    async with AsyncSessionLocal() as session:
        lecturer = (
            await session.execute(select(User).where(User.email == LECTURER_EMAIL))
        ).scalar_one_or_none()
        if lecturer is None:
            raise SystemExit(
                f"Chưa có tài khoản {LECTURER_EMAIL}. Hãy chạy scripts/seed_demo.py trước."
            )

        existing = (
            await session.execute(select(Student).where(Student.created_by == lecturer.id))
        ).scalars().first()
        if existing is not None:
            stats["skipped"] = True
        # Seed lớp học mẫu
        from src.db.models import Classroom, Document
        sample_classrooms = [
            {"name": "Lập trình C (Nhóm 01)", "code": "C_PROG_01", "subject": "Lập trình C", "description": "Lớp học lý thuyết và thực hành ngôn ngữ C cơ bản đến nâng cao."},
            {"name": "Tâm lý học nhận thức (Nhóm A)", "code": "PSY_COG_A", "subject": "Tâm lý học", "description": "Lớp nghiên cứu về các mô hình nhận thức, tư duy và trí nhớ."},
            {"name": "Nhập môn Khoa học thần kinh", "code": "NEURO_101", "subject": "Khoa học thần kinh", "description": "Lớp đại cương hệ thần kinh, dẫn truyền synapse và não bộ."},
        ]
        created_cls = {}
        for cspec in sample_classrooms:
            existing_c = (await session.execute(select(Classroom).where(Classroom.code == cspec["code"]))).scalar_one_or_none()
            if not existing_c:
                cls_obj = Classroom(created_by=lecturer.id, **cspec)
                session.add(cls_obj)
                await session.flush()
                created_cls[cspec["code"]] = cls_obj
            else:
                created_cls[cspec["code"]] = existing_c

        c_prog_cls = created_cls.get("C_PROG_01")
        for spec in STUDENTS:
            cls_id = c_prog_cls.id if c_prog_cls else None
            session.add(Student(created_by=lecturer.id, classroom_id=cls_id, **spec))
            stats["students"] += 1
        for spec in _exam_specs():
            session.add(Exam(created_by=lecturer.id, **spec))
            stats["exams"] += 1

        await session.commit()
    return stats


def main() -> int:
    stats = asyncio.run(run())
    if stats["skipped"]:
        print("Giảng viên demo đã có dữ liệu học vụ — bỏ qua.")
    else:
        print(f"Đã seed {stats['students']} sinh viên + {stats['exams']} lịch thi cho {LECTURER_EMAIL}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
