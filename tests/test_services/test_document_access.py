from types import SimpleNamespace

from src.services.document_access import is_document_viewable


def _document(*, owner=None, scope="school", classroom_id=None, status="ready"):
    return SimpleNamespace(
        uploaded_by=owner,
        metadata_json={"scope": scope},
        classroom_id=classroom_id,
        status=status,
    )


def _user(user_id, role):
    return SimpleNamespace(id=user_id, role=SimpleNamespace(name=role))


def test_student_can_retrieve_only_school_ready_enrolled_and_owned_documents():
    student = _user("student-1", "student")
    enrolled = {"class-1"}

    assert is_document_viewable(_document(), student, enrolled)
    assert is_document_viewable(
        _document(scope="classroom", classroom_id="class-1"), student, enrolled
    )
    assert is_document_viewable(
        _document(owner=student.id), student, enrolled
    )
    assert not is_document_viewable(
        _document(scope="classroom", classroom_id="class-2"), student, enrolled
    )
    assert not is_document_viewable(
        _document(scope="personal", owner="another-user"), student, enrolled
    )


def test_lecturer_can_retrieve_school_and_owned_classroom_documents():
    lecturer = _user("lecturer-1", "lecturer")

    assert is_document_viewable(_document(), lecturer, set())
    assert is_document_viewable(
        _document(owner=lecturer.id, scope="classroom", classroom_id="class-1"),
        lecturer,
        set(),
    )
    assert not is_document_viewable(
        _document(scope="classroom", classroom_id="class-1"), lecturer, set()
    )


def test_admin_can_retrieve_all_documents():
    admin = _user("admin-1", "admin")
    private = _document(scope="personal", owner="another-user", status="processing")

    assert is_document_viewable(private, admin, set())
