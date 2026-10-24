from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# LƯU Ý: KHÔNG import `agent` (LangGraph) ở top-level. Việc build graph kéo theo
# langgraph + toàn bộ node/LLM khi NẠP MODULE → làm chậm khởi động (cold start) và
# khiến đăng nhập lâu sau khi instance ngủ dậy. Agent được nạp lười ở handler /chat.
from src.api.controllers import (
    add_student_to_classroom_controller,
    agent_status_controller,
    change_my_password_controller,
    chat_controller,
    chat_stream_controller,
    create_classroom_controller,
    create_exam_controller,
    create_flashcard_controller,
    create_student_controller,
    create_user_controller,
    delete_classroom_controller,
    delete_conversation_controller,
    delete_document_controller,
    delete_exam_controller,
    delete_feedback_controller,
    delete_flashcard_controller,
    delete_quiz_controller,
    delete_student_controller,
    delete_user_controller,
    diagnostics_controller,
    eval_report_controller,
    feedback_summary_controller,
    forgot_password_controller,
    generate_flashcards_controller,
    generate_quiz_controller,
    get_classroom_controller,
    get_document_download_controller,
    get_messages_controller,
    get_quiz_controller,
    get_user_by_id_controller,
    gmail_login_controller,
    grant_user_pro_controller,
    ingest_sample_dataset_controller,
    join_classroom_controller,
    leave_classroom_controller,
    list_available_documents_controller,
    list_classroom_documents_controller,
    list_classroom_students_controller,
    list_classrooms_controller,
    list_conversations_controller,
    list_document_flashcards_controller,
    list_document_quizzes_controller,
    list_enrolled_classrooms_controller,
    list_exams_controller,
    list_my_attempts_controller,
    list_my_documents_controller,
    list_quiz_attempts_controller,
    list_recent_submissions_controller,
    list_roles_controller,
    list_students_controller,
    list_users_controller,
    login_controller,
    mark_document_viewed_controller,
    register_link_document_controller,
    remove_student_from_classroom_controller,
    rename_conversation_controller,
    reset_password_controller,
    revoke_user_pro_controller,
    signals_summary_controller,
    stats_analytics_controller,
    stats_overview_controller,
    submit_feedback_controller,
    submit_quiz_controller,
    submit_signal_controller,
    suggest_metadata_controller,
    update_classroom_controller,
    update_document_controller,
    update_exam_controller,
    update_student_controller,
    update_user_controller,
    upload_document_controller,
    verify_otp_controller,
    view_document_controller,
    view_document_text_controller,
)
from src.api.dependencies import get_current_user, get_current_user_any_status, require_roles
from src.db.models import PaymentTransaction
from src.db.session import get_db
from src.models import (
    ChangePasswordRequest,
    ChatRequest,
    ChatResponse,
    ConversationSummary,
    CreateUserRequest,
    DeleteConversationResponse,
    DeleteDocumentResponse,
    DocumentDownloadResponse,
    DocumentResponse,
    ExamCreate,
    ExamResponse,
    ExamUpdate,
    FeedbackRequest,
    FeedbackResponse,
    FeedbackSummary,
    FlashcardCreate,
    FlashcardItem,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    GenerateFlashcardsRequest,
    GenerateQuizRequest,
    GmailLoginRequest,
    GmailLoginResponse,
    IngestResponse,
    LinkDocumentRequest,
    LoginRequest,
    LoginResponse,
    MessageItem,
    QuizItem,
    QuizSubmitRequest,
    QuizSubmitResponse,
    QuizSummary,
    RecentSubmissionItem,
    RenameConversationRequest,
    ResetPasswordRequest,
    ResetPasswordResponse,
    RoleResponse,
    SignalRequest,
    SignalsSummary,
    StatsAnalytics,
    StatsOverview,
    StudentCreate,
    StudentResponse,
    StudentUpdate,
    UpdateDocumentRequest,
    UpdateUserRequest,
    UploadDocumentResponse,
    UserQuizAttemptItem,
    UserResponse,
    VerifyOtpRequest,
    VerifyOtpResponse,
)
from src.models.billing import (
    VnPayPaymentCreateRequest,
    VnPayPaymentCreateResponse,
    VnPayReconcileResponse,
)
from src.models.classroom import (
    AddStudentToClassroomRequest,
    ClassroomCreate,
    ClassroomResponse,
    ClassroomUpdate,
    JoinClassroomRequest,
)
from src.services.billing import (
    create_vnpay_checkout,
    get_billing_status,
    process_vnpay_ipn,
    query_vnpay_and_reconcile,
    reserve_chat_use,
    verify_vnpay_signature,
    vnpay_params_from_request,
)
from src.services.ingestion import ingest_rag_sample

router = APIRouter()

# RBAC: vận hành (admin) quản lý user; GV tải tài liệu; SV hỏi đáp.
# Tên role theo catalog `src/db/roles.py` (GV=lecturer, SV=student, OPS=admin).
require_admin = require_roles("admin")
require_admin_or_lecturer = require_roles("admin", "lecturer")


@router.post("/auth/login", response_model=LoginResponse, tags=["auth"])
async def login(request: LoginRequest, session: AsyncSession = Depends(get_db)) -> LoginResponse:
    return await login_controller(request, session)


@router.post("/auth/gmail-login", response_model=GmailLoginResponse, tags=["auth"])
async def gmail_login(
    request: GmailLoginRequest,
    session: AsyncSession = Depends(get_db),
) -> GmailLoginResponse:
    return await gmail_login_controller(request, session)


@router.post("/auth/forgot-password", response_model=ForgotPasswordResponse, tags=["auth"])
async def forgot_password(
    request: ForgotPasswordRequest,
    session: AsyncSession = Depends(get_db),
) -> ForgotPasswordResponse:
    return await forgot_password_controller(request, session)


@router.post("/auth/verify-otp", response_model=VerifyOtpResponse, tags=["auth"])
async def verify_otp(
    request: VerifyOtpRequest,
    session: AsyncSession = Depends(get_db),
) -> VerifyOtpResponse:
    return await verify_otp_controller(request, session)


@router.post("/auth/reset-password", response_model=ResetPasswordResponse, tags=["auth"])
async def reset_password(
    request: ResetPasswordRequest,
    session: AsyncSession = Depends(get_db),
) -> ResetPasswordResponse:
    return await reset_password_controller(request, session)


@router.get("/users", response_model=list[UserResponse], tags=["users"])
async def list_users(
    session: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
) -> list[UserResponse]:
    return await list_users_controller(session, current_user=admin)


@router.get("/roles", response_model=list[RoleResponse], tags=["users"])
async def list_roles(
    session: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
) -> list[RoleResponse]:
    return await list_roles_controller(session)


@router.get("/users/me", response_model=UserResponse, tags=["users"])
async def get_current_user_profile(
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> UserResponse:
    """Lấy thông tin hồ sơ của chính người dùng đang đăng nhập."""
    return await get_user_by_id_controller(user.id, session)


@router.put("/users/me", response_model=UserResponse, tags=["users"])
async def update_current_user(

    request: UpdateUserRequest,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> UserResponse:
    """CHẶN tự sửa hồ sơ: tên/email/lớp/khoa... chỉ QUẢN TRỊ VIÊN được cập nhật
    (qua PUT /users/{id}). Người dùng thường chỉ được đổi mật khẩu — dùng
    PUT /users/me/password."""
    raise HTTPException(
        status_code=403,
        detail=(
            "Bạn không thể tự chỉnh sửa thông tin cá nhân. Vui lòng liên hệ quản trị "
            "viên để cập nhật. Bạn chỉ có thể tự đổi mật khẩu."
        ),
    )


@router.put("/users/me/password", tags=["users"])
async def change_my_password(
    request: ChangePasswordRequest,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> dict:
    """Đổi mật khẩu của CHÍNH MÌNH — yêu cầu mật khẩu hiện tại để xác nhận."""
    return await change_my_password_controller(request, session, user)


@router.get("/users/{user_id}", response_model=UserResponse, tags=["users"])
async def get_user_by_id(
    user_id: str,
    session: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
) -> UserResponse:
    return await get_user_by_id_controller(user_id, session)


@router.post("/create-user", response_model=UserResponse, status_code=201, tags=["users"])
async def create_user(
    request: CreateUserRequest,
    session: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
) -> UserResponse:
    return await create_user_controller(request, session)


@router.put("/users/{user_id}", response_model=UserResponse, tags=["users"])
async def update_user(
    user_id: str,
    request: UpdateUserRequest,
    session: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user_any_status),
) -> UserResponse:
    current_role = current_user.role.name if current_user.role else None
    updated_fields = request.model_fields_set
    can_admin_update = current_user.status == "active" and current_role == "admin"
    can_pending_update_own_password = (
        current_user.status == "pending"
        and current_user.id == user_id
        and updated_fields == {"password"}
    )
    if not can_admin_update and not can_pending_update_own_password:
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions for this action",
        )
    if can_pending_update_own_password:
        request = UpdateUserRequest(password=request.password, status="active")
    return await update_user_controller(user_id, request, session)


@router.delete("/users/{user_id}", tags=["users"])
async def delete_user(
    user_id: str,
    session: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
) -> dict:
    return await delete_user_controller(user_id, session, admin)


@router.post("/users/{user_id}/revoke-pro", response_model=UserResponse, tags=["users"])
async def revoke_user_pro(
    user_id: str,
    session: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
) -> UserResponse:
    """Cắt quyền Pro của người dùng (quay về gói Free)."""
    return await revoke_user_pro_controller(session, user_id)


@router.post("/users/{user_id}/grant-pro", response_model=UserResponse, tags=["users"])
async def grant_user_pro(
    user_id: str,
    session: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
) -> UserResponse:
    """Cấp quyền Pro cho người dùng (30 ngày)."""
    return await grant_user_pro_controller(session, user_id)


@router.post("/datasets/rag-sample/ingest", response_model=IngestResponse)
async def ingest_sample_dataset(
    force: bool = False,
    session: AsyncSession = Depends(get_db),
    _user=Depends(require_admin_or_lecturer),
) -> IngestResponse:
    """Ingest tài liệu từ datasets/docs vào PostgreSQL + Qdrant.

    Idempotent: tài liệu không thay đổi sẽ được bỏ qua, points mồ côi bị dọn dẹp.
    Dùng `?force=true` để bắt buộc xử lý + embed lại toàn bộ.
    """
    return await ingest_sample_dataset_controller(session, ingest_rag_sample, force=force)


@router.post("/documents/upload", response_model=UploadDocumentResponse, tags=["documents"])
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    subject: str | None = Form(default=None),
    category: str | None = Form(default=None),
    title: str | None = Form(default=None),
    description: str | None = Form(default=None),
    classroom_id: str | None = Form(default=None),
    session: AsyncSession = Depends(get_db),
    user=Depends(require_admin_or_lecturer),
) -> UploadDocumentResponse:
    """Tải lên 1 tài liệu rồi ingest vào RAG (xử lý nền, trả về ngay).

    Giảng viên → tài liệu nhà trường hoặc tài liệu riêng theo lớp (scope=classroom).
    Quản trị → tài liệu nhà trường (chọn phân loại: quy định/quy chế hoặc giáo trình).
    """
    return await upload_document_controller(
        session, user, file=file, subject=subject, category=category,
        title=title, description=description, classroom_id=classroom_id,
        background_tasks=background_tasks,
    )


@router.post("/documents/link", response_model=DocumentResponse, tags=["documents"])
async def register_link_document(
    payload: LinkDocumentRequest,
    session: AsyncSession = Depends(get_db),
    user=Depends(require_admin_or_lecturer),
) -> DocumentResponse:
    """Đăng ký 1 tài liệu dạng liên kết (URL) — hiển thị trong kho, mở được ở tab mới."""
    return await register_link_document_controller(
        session,
        user,
        url=payload.url,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        subject=payload.subject,
    )


@router.post("/documents/suggest-metadata", tags=["documents"])
async def suggest_document_metadata(
    file: UploadFile | None = File(default=None),
    url: str | None = Form(default=None),
    user=Depends(require_admin_or_lecturer),
) -> dict:
    """AI gợi ý tiêu đề + mô tả từ nội dung tệp hoặc liên kết (cho form tải lên)."""
    return await suggest_metadata_controller(user, file=file, url=url)


@router.get("/documents/mine", response_model=list[DocumentResponse], tags=["documents"])
async def list_my_documents(
    classroom_id: str | None = Query(default=None),
    session: AsyncSession = Depends(get_db),
    user=Depends(require_admin_or_lecturer),
) -> list[DocumentResponse]:
    """Danh sách tài liệu: giảng viên thấy của mình, quản trị thấy tất cả. Lọc theo classroom_id nếu có."""
    return await list_my_documents_controller(session, user, classroom_id=classroom_id)


@router.get("/documents/available", response_model=list[DocumentResponse], tags=["documents"])
async def list_available_documents(
    classroom_id: str | None = Query(default=None),
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> list[DocumentResponse]:
    """Tài liệu người dùng được phép xem (thư viện). Tài liệu lớp học được cô lập theo classroom_id."""
    return await list_available_documents_controller(session, user, classroom_id=classroom_id)


@router.get("/documents/{document_id}/download", response_model=DocumentDownloadResponse, tags=["documents"])
async def download_document(
    document_id: str,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> DocumentDownloadResponse:
    """Lấy URL tải xuống tạm thời cho bản gốc tài liệu (lưu trên Cloudflare R2)."""
    return await get_document_download_controller(session, user, document_id)


@router.post("/documents/{document_id}/viewed", tags=["documents"])
async def mark_document_viewed(
    document_id: str,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> dict:
    """Đánh dấu tài liệu đã được người dùng hiện tại xem."""
    return await mark_document_viewed_controller(session, user, document_id)


@router.get("/documents/{document_id}/view", tags=["documents"])
async def view_document(
    document_id: str,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Trả nội dung file gốc inline để đọc trong popup (không tải xuống)."""
    return await view_document_controller(session, user, document_id)


@router.get("/documents/{document_id}/text", tags=["documents"])
async def view_document_text(
    document_id: str,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> dict:
    """Trả nội dung văn bản đã trích xuất (dùng cho DOCX/PPTX không xem trực tiếp được)."""
    return await view_document_text_controller(session, user, document_id)


@router.put("/documents/{document_id}", response_model=DocumentResponse, tags=["documents"])
async def update_document(
    document_id: str,
    request: UpdateDocumentRequest,
    session: AsyncSession = Depends(get_db),
    user=Depends(require_admin_or_lecturer),
) -> DocumentResponse:
    """Cập nhật metadata tài liệu. Giảng viên chỉ sửa được tài liệu của mình."""
    return await update_document_controller(session, user, document_id, request)


@router.delete("/documents/{document_id}", response_model=DeleteDocumentResponse, tags=["documents"])
async def delete_document(
    document_id: str,
    session: AsyncSession = Depends(get_db),
    user=Depends(require_admin_or_lecturer),
) -> DeleteDocumentResponse:
    """Xóa tài liệu (DB + vector Qdrant). Giảng viên chỉ xóa được của mình."""
    return await delete_document_controller(session, user, document_id)


# ----- Lớp học (Classrooms) & Cô lập tài liệu theo lớp -----


@router.get("/classrooms", response_model=list[ClassroomResponse], tags=["classrooms"])
async def list_classrooms(
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> list[ClassroomResponse]:
    """Danh sách các lớp học (admin và sinh viên thấy tất cả các lớp của mọi giảng viên; giảng viên thấy lớp do mình phụ trách)."""
    return await list_classrooms_controller(session, user)


@router.post("/classrooms", response_model=ClassroomResponse, status_code=201, tags=["classrooms"])
async def create_classroom(
    request: ClassroomCreate,
    session: AsyncSession = Depends(get_db),
    user=Depends(require_admin_or_lecturer),
) -> ClassroomResponse:
    """Tạo một lớp học mới."""
    return await create_classroom_controller(session, user, request)


@router.get("/classrooms/enrolled", response_model=list[ClassroomResponse], tags=["classrooms"])
async def list_enrolled_classrooms(
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> list[ClassroomResponse]:
    """Danh sách các lớp học sinh viên đã tham gia."""
    return await list_enrolled_classrooms_controller(session, user)


@router.post("/classrooms/join", response_model=ClassroomResponse, tags=["classrooms"])
async def join_classroom(
    payload: JoinClassroomRequest,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> ClassroomResponse:
    """Sinh viên tham gia lớp học bằng mã code."""
    return await join_classroom_controller(session, user, payload)


@router.get("/classrooms/{classroom_id}", response_model=ClassroomResponse, tags=["classrooms"])
async def get_classroom(
    classroom_id: str,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> ClassroomResponse:
    """Xem thông tin chi tiết lớp học."""
    return await get_classroom_controller(session, user, classroom_id)


@router.put("/classrooms/{classroom_id}", response_model=ClassroomResponse, tags=["classrooms"])
async def update_classroom(
    classroom_id: str,
    request: ClassroomUpdate,
    session: AsyncSession = Depends(get_db),
    user=Depends(require_admin_or_lecturer),
) -> ClassroomResponse:
    """Cập nhật thông tin lớp học."""
    return await update_classroom_controller(session, user, classroom_id, request)


@router.delete("/classrooms/{classroom_id}", tags=["classrooms"])
async def delete_classroom(
    classroom_id: str,
    session: AsyncSession = Depends(get_db),
    user=Depends(require_admin_or_lecturer),
) -> dict:
    """Xóa lớp học."""
    return await delete_classroom_controller(session, user, classroom_id)


@router.get("/classrooms/{classroom_id}/documents", response_model=list[DocumentResponse], tags=["classrooms"])
async def list_classroom_documents(
    classroom_id: str,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> list[DocumentResponse]:
    """Tài liệu thuộc lớp học này (cô lập 100%, không bị lẫn với lớp khác hay bên ngoài)."""
    return await list_classroom_documents_controller(session, user, classroom_id)


@router.post("/classrooms/{classroom_id}/documents/upload", response_model=UploadDocumentResponse, status_code=201, tags=["classrooms"])
async def upload_classroom_document(
    classroom_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    description: str | None = Form(default=None),
    session: AsyncSession = Depends(get_db),
    user=Depends(require_admin_or_lecturer),
) -> UploadDocumentResponse:
    """Tải tài liệu trực tiếp vào lớp học (cô lập riêng cho lớp này)."""
    return await upload_document_controller(
        session,
        user,
        file=file,
        classroom_id=classroom_id,
        title=title,
        description=description,
        background_tasks=background_tasks,
    )


@router.get("/classrooms/{classroom_id}/students", response_model=list[StudentResponse], tags=["classrooms"])
async def list_classroom_students(
    classroom_id: str,
    session: AsyncSession = Depends(get_db),
    user=Depends(require_admin_or_lecturer),
) -> list[StudentResponse]:
    """Danh sách sinh viên trong lớp học."""
    return await list_classroom_students_controller(session, user, classroom_id)


@router.post("/classrooms/{classroom_id}/students", response_model=StudentResponse, status_code=201, tags=["classrooms"])
async def add_student_to_classroom(
    classroom_id: str,
    request: AddStudentToClassroomRequest,
    session: AsyncSession = Depends(get_db),
    user=Depends(require_admin_or_lecturer),
) -> StudentResponse:
    """Thêm sinh viên vào lớp học."""
    return await add_student_to_classroom_controller(session, user, classroom_id, request)


@router.delete("/classrooms/{classroom_id}/students/{student_id}", tags=["classrooms"])
async def remove_student_from_classroom(
    classroom_id: str,
    student_id: str,
    session: AsyncSession = Depends(get_db),
    user=Depends(require_admin_or_lecturer),
) -> dict:
    """Xóa sinh viên khỏi lớp học."""
    return await remove_student_from_classroom_controller(session, user, classroom_id, student_id)


@router.post("/classrooms/{classroom_id}/leave", tags=["classrooms"])
async def leave_classroom(
    classroom_id: str,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> dict:
    """Sinh viên rời khỏi lớp học."""
    return await leave_classroom_controller(session, user, classroom_id)


# ----- Học vụ: sinh viên + lịch thi (giảng viên/quản trị) -----


@router.get("/students", response_model=list[StudentResponse], tags=["academic"])
async def list_students(
    subject: str | None = None,
    session: AsyncSession = Depends(get_db),
    user=Depends(require_admin_or_lecturer),
) -> list[StudentResponse]:
    return await list_students_controller(session, user, subject=subject)


@router.post("/students", response_model=StudentResponse, status_code=201, tags=["academic"])
async def create_student(
    request: StudentCreate,
    session: AsyncSession = Depends(get_db),
    user=Depends(require_admin_or_lecturer),
) -> StudentResponse:
    return await create_student_controller(session, user, request)


@router.put("/students/{student_id}", response_model=StudentResponse, tags=["academic"])
async def update_student(
    student_id: str,
    request: StudentUpdate,
    session: AsyncSession = Depends(get_db),
    user=Depends(require_admin_or_lecturer),
) -> StudentResponse:
    return await update_student_controller(session, user, student_id, request)


@router.delete("/students/{student_id}", tags=["academic"])
async def delete_student(
    student_id: str,
    session: AsyncSession = Depends(get_db),
    user=Depends(require_admin_or_lecturer),
) -> dict:
    return await delete_student_controller(session, user, student_id)


@router.get("/exams", response_model=list[ExamResponse], tags=["academic"])
async def list_exams(
    subject: str | None = None,
    session: AsyncSession = Depends(get_db),
    user=Depends(require_admin_or_lecturer),
) -> list[ExamResponse]:
    return await list_exams_controller(session, user, subject=subject)


@router.post("/exams", response_model=ExamResponse, status_code=201, tags=["academic"])
async def create_exam(
    request: ExamCreate,
    session: AsyncSession = Depends(get_db),
    user=Depends(require_admin_or_lecturer),
) -> ExamResponse:
    return await create_exam_controller(session, user, request)


@router.put("/exams/{exam_id}", response_model=ExamResponse, tags=["academic"])
async def update_exam(
    exam_id: str,
    request: ExamUpdate,
    session: AsyncSession = Depends(get_db),
    user=Depends(require_admin_or_lecturer),
) -> ExamResponse:
    return await update_exam_controller(session, user, exam_id, request)


@router.delete("/exams/{exam_id}", tags=["academic"])
async def delete_exam(
    exam_id: str,
    session: AsyncSession = Depends(get_db),
    user=Depends(require_admin_or_lecturer),
) -> dict:
    return await delete_exam_controller(session, user, exam_id)


# ----- Lịch sử hội thoại Chat AI -----


@router.get("/conversations", response_model=list[ConversationSummary], tags=["conversations"])
async def list_conversations(
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> list[ConversationSummary]:
    return await list_conversations_controller(session, user)


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[MessageItem],
    tags=["conversations"],
)
async def get_conversation_messages(
    conversation_id: str,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> list[MessageItem]:
    return await get_messages_controller(session, user, conversation_id)


@router.put(
    "/conversations/{conversation_id}",
    response_model=ConversationSummary,
    tags=["conversations"],
)
async def rename_conversation(
    conversation_id: str,
    request: RenameConversationRequest,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> ConversationSummary:
    return await rename_conversation_controller(session, user, conversation_id, request.title)


@router.delete(
    "/conversations/{conversation_id}",
    response_model=DeleteConversationResponse,
    tags=["conversations"],
)
async def delete_conversation(
    conversation_id: str,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> DeleteConversationResponse:
    return await delete_conversation_controller(session, user, conversation_id)


# ----- Thống kê realtime cho dashboard -----


@router.get("/stats/overview", response_model=StatsOverview, tags=["stats"])
async def stats_overview(
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> StatsOverview:
    return await stats_overview_controller(session, user)


@router.get("/stats/analytics", response_model=StatsAnalytics, tags=["stats"])
async def stats_analytics(
    range: str = Query("30d", pattern="^(30d|7d|24h)$"),
    session: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
) -> StatsAnalytics:
    return await stats_analytics_controller(session, admin, range)


def _role_name(user) -> str | None:
    return user.role.name if getattr(user, "role", None) else None


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ChatResponse:
    await reserve_chat_use(
        session,
        user_id=user.id,
        user_role=_role_name(user),
        request_id=request.request_id or str(uuid4()),
    )
    # Nạp lười agent: lần gọi /chat đầu tiên mới build graph, không cản startup.
    from src.agents.graph import agent

    return await chat_controller(
        request, agent, user_id=user.id, user_role=_role_name(user), session=session
    )


@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Chat RAG trả lời theo token (Server-Sent Events)."""
    await reserve_chat_use(
        session,
        user_id=user.id,
        user_role=_role_name(user),
        request_id=request.request_id or str(uuid4()),
    )
    return chat_stream_controller(request, user_id=user.id, user_role=_role_name(user))


@router.get("/billing/me", tags=["billing"])
async def billing_me(
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> dict:
    return await get_billing_status(session, user_id=user.id, user_role=_role_name(user))


@router.post(
    "/payments/vnpay/create",
    response_model=VnPayPaymentCreateResponse,
    tags=["payments"],
    summary="Create VNPay payment",
    description="Create a 99,000 VND Pro monthly checkout URL for the authenticated student.",
)
@router.post(
    "/billing/vnpay/checkout",
    response_model=VnPayPaymentCreateResponse,
    tags=["billing"],
    include_in_schema=False,
)
async def vnpay_checkout(
    payload: VnPayPaymentCreateRequest,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> VnPayPaymentCreateResponse:
    if _role_name(user) != "student":
        raise HTTPException(status_code=403, detail="Gói Pro chỉ dành cho sinh viên.")
    result = await create_vnpay_checkout(
        session,
        user=user,
        ip_address=request.client.host if request.client else "127.0.0.1",
        return_to=payload.return_to,
    )
    return VnPayPaymentCreateResponse(**result)


@router.post(
    "/payments/vnpay/reconcile/{order_code}",
    response_model=VnPayReconcileResponse,
    tags=["payments"],
    summary="Check VNPay payment status",
    description="Queries VNPay directly; no inbound IPN callback is required.",
)
async def reconcile_vnpay_payment(
    order_code: int,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> VnPayReconcileResponse:
    if _role_name(user) != "student":
        raise HTTPException(status_code=403, detail="Chỉ sinh viên được kiểm tra thanh toán Pro.")
    result = await session.execute(
        select(PaymentTransaction).where(
            PaymentTransaction.order_code == order_code,
            PaymentTransaction.user_id == user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn thanh toán.")
    from src.config import get_settings

    status = await query_vnpay_and_reconcile(
        session,
        order_code=order_code,
        ip_address=get_settings().vnpay_server_ip,
    )
    return VnPayReconcileResponse(
        order_code=order_code,
        status="paid" if status == "paid" else "pending",
        message="Đã xác nhận thanh toán và kích hoạt Pro." if status == "paid" else "VNPay chưa xác nhận giao dịch. Vui lòng kiểm tra lại sau.",
    )


@router.get(
    "/payments/vnpay/ipn",
    tags=["payments"],
    summary="VNPay server notification",
    description="Server-to-server callback; a valid signature and matching order amount are required.",
)
@router.get("/billing/vnpay/ipn", include_in_schema=False)
async def vnpay_ipn(
    request: Request,
    session: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    return await process_vnpay_ipn(session, vnpay_params_from_request(request))


@router.get(
    "/payments/vnpay/return",
    tags=["payments"],
    summary="VNPay browser return",
    description="Verifies the return signature and redirects to the app. The IPN callback is authoritative for activation.",
)
@router.get("/billing/vnpay/return", include_in_schema=False)
async def vnpay_return(request: Request, session: AsyncSession = Depends(get_db)):
    from src.config import get_settings

    settings = get_settings()
    params = vnpay_params_from_request(request)
    status = "invalid"
    if (
        verify_vnpay_signature(params, settings.vnpay_hash_secret)
        and params.get("vnp_TmnCode") == settings.vnpay_tmn_code
    ):
        try:
            order_code = int(params.get("vnp_TxnRef", ""))
            amount = int(params.get("vnp_Amount", ""))
        except ValueError:
            order_code = 0
            amount = 0
        payment = await session.scalar(
            select(PaymentTransaction).where(PaymentTransaction.order_code == order_code)
        )
        if payment is not None and amount == payment.amount * 100:
            if payment.status == "paid":
                status = "success"
            elif (
                params.get("vnp_ResponseCode") == "00"
                and params.get("vnp_TransactionStatus") == "00"
            ):
                result = await query_vnpay_and_reconcile(
                    session,
                    order_code=order_code,
                    ip_address=settings.vnpay_server_ip,
                )
                status = "success" if result == "paid" else "pending"
            else:
                status = "failed"
        else:
            status = "failed"
    return_path = "/student/chat"
    if payment and payment.raw_webhook and isinstance(payment.raw_webhook, dict):
        custom_return = payment.raw_webhook.get("return_to")
        if custom_return and isinstance(custom_return, str) and custom_return.startswith("/student/"):
            return_path = custom_return

    sep = "&" if "?" in return_path else "?"
    target = (
        f"{settings.frontend_url.rstrip('/')}{return_path}"
        f"{sep}payment={status}&order_code={order_code}"
    )
    return RedirectResponse(target, status_code=303)


@router.post("/chat/feedback", response_model=FeedbackResponse, tags=["chat"])
async def chat_feedback(
    request: FeedbackRequest,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> FeedbackResponse:
    """Người dùng đánh giá 1 câu trả lời AI (👍/👎 + lý do) — feedback loop."""
    return await submit_feedback_controller(request, session, user)


@router.delete("/chat/feedback/{message_id}", response_model=FeedbackResponse, tags=["chat"])
async def chat_feedback_delete(
    message_id: str,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> FeedbackResponse:
    """HoÃ n tÃ¡c Ä‘Ã¡nh giÃ¡ ðŸ‘/ðŸ‘Ž cá»§a user hiá»‡n táº¡i cho 1 cÃ¢u tráº£ lá»i AI."""
    return await delete_feedback_controller(message_id, session, user)


@router.get("/chat/feedback/summary", response_model=FeedbackSummary, tags=["chat"])
async def chat_feedback_summary(
    _admin=Depends(require_admin),
    session: AsyncSession = Depends(get_db),
) -> FeedbackSummary:
    """Tổng hợp feedback cho dashboard admin (tỉ lệ hữu ích, góp ý gần đây)."""
    return await feedback_summary_controller(session)


@router.get("/chat/eval/report", tags=["chat"])
async def chat_eval_report(_admin=Depends(require_admin)) -> dict:
    """Báo cáo đánh giá RAG offline gần nhất (faithfulness, relevancy, latency, cost)."""
    return await eval_report_controller()


@router.post("/chat/signal", tags=["chat"])
async def chat_signal(
    request: SignalRequest,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Ghi tín hiệu implicit (hành vi) hoặc system (hệ thống) cho 1 câu trả lời."""
    return await submit_signal_controller(request, session, user)


@router.get("/chat/signals/summary", response_model=SignalsSummary, tags=["chat"])
async def chat_signals_summary(
    _admin=Depends(require_admin),
    session: AsyncSession = Depends(get_db),
) -> SignalsSummary:
    """Tổng hợp tín hiệu implicit + system cho dashboard admin."""
    return await signals_summary_controller(session)


@router.get("/status")
async def agent_status():
    return await agent_status_controller()


@router.get("/diagnostics", tags=["system"])
async def diagnostics(
    session: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
) -> dict:
    """Soi cấu hình runtime (admin) để chẩn đoán lỗi deploy — không lộ secret."""
    return await diagnostics_controller(session)


@router.post("/admin/reindex", tags=["system"])
async def admin_reindex(
    session: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
) -> dict:
    """Đồng bộ lại Qdrant từ DB (admin) — sửa khi chatbot 'không đủ dữ liệu' do
    vector Qdrant lệch với chunks ở DB. Re-embed chunks đã có + dọn điểm mồ côi."""
    from src.services.reindex import reindex_all

    return await reindex_all(session)


# ---------------- Study Aid (Flashcards & Quizzes) ----------------


@router.get(
    "/documents/{document_id}/flashcards",
    response_model=list[FlashcardItem],
    tags=["study-aid"],
    summary="List all flashcards for a document",
)
async def list_document_flashcards(
    document_id: str,
    session: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
) -> list[FlashcardItem]:
    return await list_document_flashcards_controller(session, document_id, user=_user)


@router.post(
    "/documents/{document_id}/flashcards",
    response_model=FlashcardItem,
    tags=["study-aid"],
    summary="Create a flashcard manually",
)
async def create_flashcard(
    document_id: str,
    payload: FlashcardCreate,
    session: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
) -> FlashcardItem:
    return await create_flashcard_controller(session, document_id, payload, user=_user)


@router.post(
    "/documents/{document_id}/flashcards/generate",
    response_model=list[FlashcardItem],
    tags=["study-aid"],
    summary="Generate flashcards using AI",
)
async def generate_flashcards(
    document_id: str,
    payload: GenerateFlashcardsRequest,
    session: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
) -> list[FlashcardItem]:
    return await generate_flashcards_controller(session, document_id, payload, user=_user)


@router.delete(
    "/flashcards/{flashcard_id}",
    tags=["study-aid"],
    summary="Delete a flashcard",
)
async def delete_flashcard(
    flashcard_id: str,
    session: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
) -> dict[str, str]:
    return await delete_flashcard_controller(session, flashcard_id, user=_user)


@router.get(
    "/documents/{document_id}/quizzes",
    response_model=list[QuizSummary],
    tags=["study-aid"],
    summary="List quizzes for a document",
)
async def list_document_quizzes(
    document_id: str,
    session: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
) -> list[QuizSummary]:
    return await list_document_quizzes_controller(session, document_id, user=_user)


@router.post(
    "/documents/{document_id}/quizzes/generate",
    response_model=QuizItem,
    tags=["study-aid"],
    summary="Generate a multiple-choice quiz using AI",
)
async def generate_quiz(
    document_id: str,
    payload: GenerateQuizRequest,
    session: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
) -> QuizItem:
    return await generate_quiz_controller(session, document_id, payload, user=_user)


@router.get(
    "/quizzes/{quiz_id}",
    response_model=QuizItem,
    tags=["study-aid"],
    summary="Get quiz details with questions",
)
async def get_quiz(
    quiz_id: str,
    include_answers: bool = Query(
        default=False,
        description="Hiển thị đáp án đúng và giải thích (chỉ dành cho Giảng viên/Admin hoặc sinh viên đã hoàn thành nộp bài)",
    ),
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> QuizItem:
    return await get_quiz_controller(session, user, quiz_id, include_answers=include_answers)


@router.delete(
    "/quizzes/{quiz_id}",
    tags=["study-aid"],
    summary="Delete a quiz",
)
async def delete_quiz(
    quiz_id: str,
    session: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
) -> dict[str, str]:
    return await delete_quiz_controller(session, quiz_id, user=_user)


@router.post(
    "/quizzes/{quiz_id}/submit",
    response_model=QuizSubmitResponse,
    tags=["study-aid"],
    summary="Submit quiz answers and evaluate score",
)
async def submit_quiz(
    quiz_id: str,
    payload: QuizSubmitRequest,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> QuizSubmitResponse:
    return await submit_quiz_controller(session, user, quiz_id, payload)


@router.get(
    "/quizzes/{quiz_id}/attempts",
    response_model=list[UserQuizAttemptItem],
    tags=["study-aid"],
    summary="List attempts for a quiz",
)
async def list_quiz_attempts(
    quiz_id: str,
    session: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
) -> list[UserQuizAttemptItem]:
    return await list_quiz_attempts_controller(session, quiz_id)


@router.get(
    "/study-aid/my-attempts",
    response_model=list[UserQuizAttemptItem],
    tags=["study-aid"],
    summary="List all quiz attempts of current user",
)
async def list_my_attempts(
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> list[UserQuizAttemptItem]:
    return await list_my_attempts_controller(session, user)


@router.get(
    "/study-aid/recent-submissions",
    response_model=list[RecentSubmissionItem],
    tags=["study-aid"],
    summary="List recent quiz submissions for lecturer or student",
)
async def list_recent_submissions(
    limit: int = 10,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> list[RecentSubmissionItem]:
    return await list_recent_submissions_controller(session, user, limit=limit)

