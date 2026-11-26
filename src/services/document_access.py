from sqlalchemy.ext.asyncio import AsyncSession

from src.repositories import classroom_repo, document_repo


def is_document_viewable(document, user, enrolled_classroom_ids: set[str]) -> bool:
    role = user.role.name if getattr(user, "role", None) else None
    metadata = document.metadata_json or {}
    classroom_id = getattr(document, "classroom_id", None) or metadata.get("classroom_id")
    scope = metadata.get("scope", "school")

    if role == "admin":
        return True
    if role == "lecturer":
        if document.uploaded_by == user.id:
            return True
        return not classroom_id and scope == "school"

    if document.uploaded_by == user.id and document.status == "ready":
        return True
    if classroom_id:
        return str(classroom_id) in enrolled_classroom_ids and document.status == "ready"
    if scope == "classroom":
        return False
    return scope == "school" and document.status == "ready"


async def list_viewable_documents(session: AsyncSession, user) -> list:
    documents = await document_repo.list_documents(session)
    role = user.role.name if getattr(user, "role", None) else None
    enrolled_classroom_ids: set[str] = set()
    if role == "student" and session is not None:
        enrolled = await classroom_repo.list_student_enrolled_classrooms(session, user)
        enrolled_classroom_ids = {str(classroom.id) for classroom in enrolled}

    return [
        document
        for document in documents
        if is_document_viewable(document, user, enrolled_classroom_ids)
    ]
