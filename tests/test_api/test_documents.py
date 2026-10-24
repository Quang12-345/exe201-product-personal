from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from src.api.controllers import document_controller
from src.models.dataset import UpdateDocumentRequest


def _doc(**kw):
    base = dict(
        id="doc-1",
        title="Bài giảng",
        file_name="bg.pdf",
        file_type="pdf",
        status="ready",
        total_pages=3,
        total_chunks=10,
        uploaded_by="lecturer-1",
        metadata_json={"scope": "personal", "subject": "CNPM"},
        storage_path="datasets/uploads/lecturer-1/abc_bg.pdf",
        created_at=None,
    )
    base.update(kw)
    return SimpleNamespace(**base)


@pytest.mark.asyncio
async def test_upload_requires_authentication(client):
    response = await client.post("/api/v1/documents/upload")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_my_documents_requires_authentication(client):
    response = await client.get("/api/v1/documents/mine")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_my_documents_forbidden_for_student(client, as_student):
    response = await client.get("/api/v1/documents/mine")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_upload_rejects_unsupported_extension(client, monkeypatch, as_lecturer):
    # Không nên gọi tới ingest khi định dạng bị từ chối.
    response = await client.post(
        "/api/v1/documents/upload",
        files={"file": ("archive.zip", b"PK\x03\x04hello", "application/zip")},
    )
    assert response.status_code == 400
    assert "hỗ trợ" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_upload_lecturer_uses_school_scope(monkeypatch, tmp_path):
    captured = {}

    async def fake_ingest(session, path, **kwargs):
        captured.update(kwargs)
        captured["path"] = path
        return {"chunks": 4, "points": 4, "failed_documents": 0}

    async def fake_get(session, storage_path):
        return _doc(storage_path=storage_path)

    monkeypatch.setattr(document_controller, "UPLOAD_DIR", tmp_path)
    monkeypatch.setattr(document_controller, "ingest_document_file", fake_ingest)
    monkeypatch.setattr(
        document_controller.document_repo, "get_document_by_storage_path", fake_get
    )

    user = SimpleNamespace(id="lecturer-1", role=SimpleNamespace(name="lecturer"))
    upload = SimpleNamespace(filename="slide.pdf", read=_reader(b"%PDF-1.4 data"))

    result = await document_controller.upload_document_controller(
        None, user, file=upload, subject="CNPM"
    )

    assert captured["scope"] == "school"
    assert captured["owner_id"] == "lecturer-1"
    assert captured["subject"] == "CNPM"
    assert result.chunks == 4


@pytest.mark.asyncio
async def test_upload_admin_uses_school_scope(monkeypatch, tmp_path):
    captured = {}

    async def fake_ingest(session, path, **kwargs):
        captured.update(kwargs)
        return {"chunks": 1, "points": 1, "failed_documents": 0}

    async def fake_get(session, storage_path):
        return _doc(storage_path=storage_path)

    monkeypatch.setattr(document_controller, "UPLOAD_DIR", tmp_path)
    monkeypatch.setattr(document_controller, "ingest_document_file", fake_ingest)
    monkeypatch.setattr(
        document_controller.document_repo, "get_document_by_storage_path", fake_get
    )

    user = SimpleNamespace(id="admin-1", role=SimpleNamespace(name="admin"))
    upload = SimpleNamespace(filename="quy-che.pdf", read=_reader(b"%PDF data"))

    await document_controller.upload_document_controller(None, user, file=upload, subject=None)
    assert captured["scope"] == "school"
    assert captured["owner_id"] == "admin-1"


@pytest.mark.asyncio
async def test_link_document_lecturer_uses_school_scope(monkeypatch):
    captured = {}

    async def fake_upsert(session, title, file_path, metadata, uploaded_by):
        captured.update(
            title=title,
            file_path=file_path,
            metadata=metadata,
            uploaded_by=uploaded_by,
        )
        return _doc(
            title=title,
            file_name=file_path.name,
            file_type="link",
            uploaded_by=uploaded_by,
            metadata_json=metadata,
        )

    class FakeSession:
        commits = 0

        async def commit(self):
            self.commits += 1

    monkeypatch.setattr(document_controller.document_repo, "upsert_document", fake_upsert)

    user = SimpleNamespace(id="lecturer-1", full_name="GV", role=SimpleNamespace(name="lecturer"))
    session = FakeSession()

    response = await document_controller.register_link_document_controller(
        session,
        user,
        url="https://example.com/doc",
        title="Link bài giảng",
        subject="CNPM",
    )

    assert captured["metadata"]["scope"] == "school"
    assert captured["metadata"]["category"] == "syllabus"
    assert captured["metadata"]["subject"] == "CNPM"
    assert captured["uploaded_by"] == "lecturer-1"
    assert response.scope == "school"
    assert response.subject == "CNPM"
    assert session.commits == 1


@pytest.mark.asyncio
async def test_delete_forbidden_for_other_owner(monkeypatch):
    async def fake_get(session, document_id):
        return _doc(uploaded_by="someone-else")

    monkeypatch.setattr(document_controller.document_repo, "get_document", fake_get)

    user = SimpleNamespace(id="lecturer-1", role=SimpleNamespace(name="lecturer"))
    with pytest.raises(HTTPException) as exc:
        await document_controller.delete_document_controller(None, user, "doc-1")
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_view_document_text_for_link_fetches_url_content(monkeypatch):
    from src.services import metadata_suggester

    doc = _doc(
        file_name="link_abcd.url",
        file_type="link",
        metadata_json={"scope": "school", "kind": "link", "url": "https://example.com/doc"},
    )
    captured = {}

    async def fake_get(session, document_id):
        return doc

    async def fake_chunks(session, document_id):
        return []

    async def fake_mark_viewed(session, document_id, user_id):
        captured["viewed"] = (document_id, user_id)

    async def fake_fetch_link_text(url):
        captured["url"] = url
        return "Example title", "Example body"

    async def fail_local_file(document):
        raise AssertionError("link previews should not read a local file")

    class FakeSession:
        commits = 0

        async def commit(self):
            self.commits += 1

    monkeypatch.setattr(document_controller.document_repo, "get_document", fake_get)
    monkeypatch.setattr(document_controller.document_repo, "list_chunks_by_document", fake_chunks)
    monkeypatch.setattr(document_controller.document_repo, "mark_document_viewed", fake_mark_viewed)
    monkeypatch.setattr(document_controller, "_ensure_local_file", fail_local_file)
    monkeypatch.setattr(metadata_suggester, "fetch_link_text", fake_fetch_link_text)

    user = SimpleNamespace(id="student-1", role=SimpleNamespace(name="student"))
    session = FakeSession()
    result = await document_controller.view_document_text_controller(session, user, "doc-1")

    assert result["file_type"] == "link"
    assert result["url"] == "https://example.com/doc"
    assert result["text"] == "Example title\n\nExample body"
    assert captured["url"] == "https://example.com/doc"
    assert captured["viewed"] == ("doc-1", "student-1")
    assert session.commits == 1


@pytest.mark.asyncio
async def test_view_document_text_for_link_falls_back_when_url_content_empty(monkeypatch):
    from src.services import metadata_suggester

    doc = _doc(
        title="Trang tham khảo",
        file_name="link_abcd.url",
        file_type="link",
        metadata_json={
            "scope": "school",
            "kind": "link",
            "url": "https://example.com/blocked",
            "description": "Mô tả đã lưu",
        },
    )

    async def fake_get(session, document_id):
        return doc

    async def fake_chunks(session, document_id):
        return []

    async def fake_mark_viewed(session, document_id, user_id):
        return None

    async def fake_fetch_link_text(url):
        return "", ""

    class FakeSession:
        async def commit(self):
            return None

    monkeypatch.setattr(document_controller.document_repo, "get_document", fake_get)
    monkeypatch.setattr(document_controller.document_repo, "list_chunks_by_document", fake_chunks)
    monkeypatch.setattr(document_controller.document_repo, "mark_document_viewed", fake_mark_viewed)
    monkeypatch.setattr(metadata_suggester, "fetch_link_text", fake_fetch_link_text)

    user = SimpleNamespace(id="student-1", role=SimpleNamespace(name="student"))
    result = await document_controller.view_document_text_controller(FakeSession(), user, "doc-1")

    assert result["file_type"] == "link"
    assert "Trang tham khảo" in result["text"]
    assert "Mô tả đã lưu" in result["text"]
    assert "https://example.com/blocked" in result["text"]


@pytest.mark.asyncio
async def test_available_documents_include_regulation_for_student(monkeypatch):
    """Thư viện sinh viên thấy tài liệu nhà trường đã sẵn sàng, gồm cả quy chế."""
    docs = [
        _doc(id="syl", uploaded_by="admin-1",
             metadata_json={"scope": "school", "category": "syllabus"}),
        _doc(id="reg", uploaded_by="admin-1",
             metadata_json={"scope": "school", "category": "regulation"}),
        _doc(id="personal", uploaded_by="lecturer-9",
             metadata_json={"scope": "personal", "category": "syllabus"}),
        _doc(id="not-ready", status="processing", uploaded_by="admin-1",
             metadata_json={"scope": "school", "category": "syllabus"}),
    ]

    async def fake_list(session):
        return docs

    async def fake_list_all(session):
        return []

    async def fake_viewed(session, user_id):
        return set()

    monkeypatch.setattr(document_controller.document_repo, "list_documents", fake_list)
    monkeypatch.setattr(document_controller.document_repo, "list_viewed_document_ids", fake_viewed)
    monkeypatch.setattr(document_controller.user_repo, "list_all", fake_list_all)

    student = SimpleNamespace(id="s1", full_name="SV", role=SimpleNamespace(name="student"))
    result = await document_controller.list_available_documents_controller(None, student)

    visible_ids = {r.id for r in result}
    assert visible_ids == {"syl", "reg"}  # tài liệu nhà trường đã sẵn sàng
    assert all(r.is_new for r in result)


@pytest.mark.asyncio
async def test_available_documents_marks_viewed_documents_not_new(monkeypatch):
    docs = [
        _doc(id="new-doc", uploaded_by="admin-1",
             metadata_json={"scope": "school", "category": "syllabus"}),
        _doc(id="seen-doc", uploaded_by="admin-1",
             metadata_json={"scope": "school", "category": "syllabus"}),
    ]

    async def fake_list(session):
        return docs

    async def fake_list_all(session):
        return []

    async def fake_viewed(session, user_id):
        return {"seen-doc"}

    monkeypatch.setattr(document_controller.document_repo, "list_documents", fake_list)
    monkeypatch.setattr(document_controller.document_repo, "list_viewed_document_ids", fake_viewed)
    monkeypatch.setattr(document_controller.user_repo, "list_all", fake_list_all)

    student = SimpleNamespace(id="s1", full_name="SV", role=SimpleNamespace(name="student"))
    result = await document_controller.list_available_documents_controller(None, student)

    by_id = {r.id: r for r in result}
    assert by_id["new-doc"].is_new is True
    assert by_id["seen-doc"].is_new is False


@pytest.mark.asyncio
async def test_available_documents_lecturer_sees_regulation_and_own(monkeypatch):
    docs = [
        _doc(id="reg", uploaded_by="admin-1",
             metadata_json={"scope": "school", "category": "regulation"}),
        _doc(id="mine", uploaded_by="lecturer-1",
             metadata_json={"scope": "personal", "category": "syllabus"}),
        _doc(id="other", uploaded_by="lecturer-9",
             metadata_json={"scope": "personal", "category": "syllabus"}),
    ]

    async def fake_list(session):
        return docs

    async def fake_list_all(session):
        return []

    async def fake_viewed(session, user_id):
        return set()

    monkeypatch.setattr(document_controller.document_repo, "list_documents", fake_list)
    monkeypatch.setattr(document_controller.document_repo, "list_viewed_document_ids", fake_viewed)
    monkeypatch.setattr(document_controller.user_repo, "list_all", fake_list_all)

    lecturer = SimpleNamespace(id="lecturer-1", full_name="GV", role=SimpleNamespace(name="lecturer"))
    result = await document_controller.list_available_documents_controller(None, lecturer)

    visible_ids = {r.id for r in result}
    assert visible_ids == {"reg", "mine"}  # quy định nhà trường + tài liệu của mình


@pytest.mark.asyncio
async def test_available_documents_includes_enrolled_classroom_documents_for_student(monkeypatch):
    docs = [
        _doc(id="school-doc", uploaded_by="admin-1",
             metadata_json={"scope": "school", "category": "syllabus"}),
        _doc(id="enrolled-class-doc", uploaded_by="lecturer-1", classroom_id="class-1",
             metadata_json={"scope": "school", "classroom_id": "class-1"}),
        _doc(id="other-class-doc", uploaded_by="lecturer-2", classroom_id="class-2",
             metadata_json={"scope": "school", "classroom_id": "class-2"}),
    ]

    async def fake_list(session):
        return docs

    async def fake_list_all(session):
        return []

    async def fake_viewed(session, user_id):
        return set()

    async def fake_enrolled(session, user):
        return [SimpleNamespace(id="class-1", name="Lớp 1")]

    monkeypatch.setattr(document_controller.document_repo, "list_documents", fake_list)
    monkeypatch.setattr(document_controller.document_repo, "list_viewed_document_ids", fake_viewed)
    monkeypatch.setattr(document_controller.user_repo, "list_all", fake_list_all)
    monkeypatch.setattr(document_controller.classroom_repo, "list_student_enrolled_classrooms", fake_enrolled)

    student = SimpleNamespace(id="s1", full_name="SV", role=SimpleNamespace(name="student"))
    result = await document_controller.list_available_documents_controller(object(), student)

    visible_ids = {r.id for r in result}
    assert visible_ids == {"school-doc", "enrolled-class-doc"}



@pytest.mark.asyncio
async def test_delete_missing_document_404(monkeypatch):
    async def fake_get(session, document_id):
        return None

    monkeypatch.setattr(document_controller.document_repo, "get_document", fake_get)
    user = SimpleNamespace(id="admin-1", role=SimpleNamespace(name="admin"))
    with pytest.raises(HTTPException) as exc:
        await document_controller.delete_document_controller(None, user, "missing")
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_update_document_changes_title_category_and_subject(monkeypatch):
    doc = _doc(
        uploaded_by="admin-1",
        metadata_json={"scope": "personal", "subject": "CNPM", "category": "syllabus"},
    )

    async def fake_get(session, document_id):
        return doc

    class FakeSession:
        commits = 0

        async def commit(self):
            self.commits += 1

    monkeypatch.setattr(document_controller.document_repo, "get_document", fake_get)
    user = SimpleNamespace(id="admin-1", full_name="Admin", role=SimpleNamespace(name="admin"))
    session = FakeSession()

    response = await document_controller.update_document_controller(
        session,
        user,
        "doc-1",
        UpdateDocumentRequest(title="Tên mới", category="regulation", subject=None),
    )

    assert doc.title == "Tên mới"
    assert doc.metadata_json["category"] == "regulation"
    assert doc.metadata_json["subject"] is None
    assert response.title == "Tên mới"
    assert response.category == "regulation"
    assert session.commits == 1


@pytest.mark.asyncio
async def test_update_document_forbidden_for_other_owner(monkeypatch):
    async def fake_get(session, document_id):
        return _doc(uploaded_by="someone-else")

    monkeypatch.setattr(document_controller.document_repo, "get_document", fake_get)
    user = SimpleNamespace(id="lecturer-1", role=SimpleNamespace(name="lecturer"))

    with pytest.raises(HTTPException) as exc:
        await document_controller.update_document_controller(
            None,
            user,
            "doc-1",
            UpdateDocumentRequest(title="Tên mới"),
        )

    assert exc.value.status_code == 403


def _reader(data: bytes):
    async def read():
        return data

    return read
