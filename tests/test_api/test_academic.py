from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from src.api.controllers import academic_controller
from src.models.academic import ExamCreate, StudentCreate, StudentUpdate


def _user(role, uid):
    return SimpleNamespace(id=uid, role=SimpleNamespace(name=role))


# ----- Route auth -----

@pytest.mark.asyncio
async def test_students_requires_authentication(client):
    assert (await client.get("/api/v1/students")).status_code == 401


@pytest.mark.asyncio
async def test_exams_requires_authentication(client):
    assert (await client.get("/api/v1/exams")).status_code == 401


@pytest.mark.asyncio
async def test_students_forbidden_for_student(client, as_student):
    assert (await client.get("/api/v1/students")).status_code == 403


# ----- Scoping theo vai trò -----

@pytest.mark.asyncio
async def test_lecturer_list_scoped_to_self(monkeypatch):
    captured = {}

    async def fake_list(session, *, owner_id=None, subject=None):
        captured["owner_id"] = owner_id
        captured["subject"] = subject
        return []

    monkeypatch.setattr(academic_controller.student_repo, "list_students", fake_list)
    await academic_controller.list_students_controller(
        None, _user("lecturer", "lec-1"), subject="CNPM"
    )
    assert captured["owner_id"] == "lec-1"
    assert captured["subject"] == "CNPM"


@pytest.mark.asyncio
async def test_admin_list_not_scoped(monkeypatch):
    captured = {}

    async def fake_list(session, *, owner_id=None, subject=None):
        captured["owner_id"] = owner_id
        return []

    monkeypatch.setattr(academic_controller.exam_repo, "list_exams", fake_list)
    await academic_controller.list_exams_controller(None, _user("admin", "ad-1"))
    assert captured["owner_id"] is None


# ----- created_by gán theo người tạo -----

@pytest.mark.asyncio
async def test_create_student_sets_created_by(monkeypatch):
    captured = {}

    async def fake_create(session, **values):
        captured.update(values)
        return SimpleNamespace(
            id="s1", created_at=None, created_by=values.get("created_by"), **{
                k: values[k] for k in ("student_code", "full_name", "subject", "email", "note")
            }
        )

    class FakeSession:
        async def commit(self):
            return None

    monkeypatch.setattr(academic_controller.student_repo, "create_student", fake_create)
    payload = StudentCreate(student_code="SV1", full_name="A", subject="CNPM")
    result = await academic_controller.create_student_controller(
        FakeSession(), _user("lecturer", "lec-9"), payload
    )
    assert captured["created_by"] == "lec-9"
    assert result.student_code == "SV1"


# ----- RBAC sửa/xóa -----

@pytest.mark.asyncio
async def test_update_student_forbidden_for_other_owner(monkeypatch):
    async def fake_get(session, sid):
        return SimpleNamespace(id=sid, created_by="someone-else")

    monkeypatch.setattr(academic_controller.student_repo, "get_student", fake_get)
    with pytest.raises(HTTPException) as exc:
        await academic_controller.update_student_controller(
            None, _user("lecturer", "lec-1"), "s1", StudentUpdate(full_name="X")
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_delete_exam_missing_404(monkeypatch):
    async def fake_get(session, eid):
        return None

    monkeypatch.setattr(academic_controller.exam_repo, "get_exam", fake_get)
    with pytest.raises(HTTPException) as exc:
        await academic_controller.delete_exam_controller(None, _user("admin", "ad-1"), "missing")
    assert exc.value.status_code == 404


def test_exam_create_schema_defaults():
    e = ExamCreate(subject="CNPM", title="Thi cuối kỳ")
    assert e.duration_minutes == 0
    assert e.exam_date is None
