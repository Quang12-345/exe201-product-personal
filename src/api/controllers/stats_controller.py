"""Thống kê realtime cho dashboard — đếm trực tiếp từ DB theo vai trò."""

from collections import Counter
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import User
from src.db.roles import role_display_name
from src.models.stats import (
    AnalyticsStat,
    RecentDocument,
    RoleBreakdown,
    StatCard,
    StatsAnalytics,
    StatsOverview,
    TopicInterest,
    TrafficPoint,
    UnansweredQuestion,
)
from src.repositories import (
    conversation_repo,
    document_repo,
    exam_repo,
    student_repo,
    user_repo,
)


def _role_name(user: User) -> str | None:
    return user.role.name if getattr(user, "role", None) else None


def _doc_meta(doc, key, default=None):
    return (doc.metadata_json or {}).get(key, default)


def _recent(docs, owners: dict | None = None, limit: int = 6) -> list[RecentDocument]:
    items = []
    for doc in docs[:limit]:
        items.append(
            RecentDocument(
                id=doc.id,
                title=doc.title,
                subject=_doc_meta(doc, "subject"),
                category=_doc_meta(doc, "category", "syllabus"),
                status=doc.status,
                owner_name=(owners or {}).get(doc.uploaded_by) if owners else None,
                created_at=doc.created_at,
            )
        )
    return items


def _weekday_label(day: datetime) -> str:
    return ["T2", "T3", "T4", "T5", "T6", "T7", "CN"][day.weekday()]


def _date_label(day: datetime) -> str:
    return day.strftime("%d/%m")


def _hour_label(hour: datetime) -> str:
    return (hour + timedelta(hours=7)).strftime("%H:00")


def _hour_range_label(start: datetime) -> str:
    local_start = start + timedelta(hours=7)
    local_end = local_start + timedelta(hours=2)
    return f"{local_start:%H}:00-{local_end:%H}:00"


def _analytics_range(range_key: str) -> tuple[datetime, str, str, int]:
    now = datetime.utcnow()
    if range_key == "24h":
        return now - timedelta(hours=23), "24h vừa qua", "hour3", 8
    if range_key == "7d":
        return now - timedelta(days=6), "7 ngày qua", "day", 7
    return now - timedelta(days=29), "30 ngày qua", "day", 30


def _role_label(role: str) -> str:
    return role_display_name(role)


def _topic_name(metadata: dict) -> str:
    for key in ("subject", "category", "field", "topic"):
        value = metadata.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return "Khác"


def _format_ms(value: int) -> str:
    if value >= 1000:
        return f"{value / 1000:.1f}s"
    return f"{value}ms"


async def stats_overview_controller(session: AsyncSession, user: User) -> StatsOverview:
    role = _role_name(user)

    if role == "admin":
        users = await user_repo.list_all(session)
        documents = await document_repo.list_documents(session)  # đã sort desc theo created_at
        owners = {u.id: u.full_name for u in users}
        ready = sum(1 for d in documents if d.status == "ready")
        # Đếm ĐỒNG NHẤT với trang "Quản lý người dùng": bỏ tài khoản đã vô hiệu hóa
        # (status='deleted') và bỏ chính tài khoản đang xem (trang quản lý không liệt kê).
        visible_users = [u for u in users if u.status != "deleted" and u.id != user.id]
        cards = [
            StatCard(key="users", label="Tổng người dùng", value=len(visible_users)),
            StatCard(key="documents", label="Tổng tài liệu", value=len(documents),
                     note=f"{ready} đã lập chỉ mục"),
            StatCard(key="conversations", label="Tổng hội thoại",
                     value=await conversation_repo.count_conversations(session)),
            StatCard(key="queries", label="Tổng lượt hỏi AI",
                     value=await conversation_repo.count_agent_runs(session)),
        ]
        return StatsOverview(role=role, cards=cards, recent_documents=_recent(documents, owners))

    if role == "lecturer":
        documents = await document_repo.list_documents_by_owner(session, user.id)
        students = await student_repo.list_students(session, owner_id=user.id)
        exams = await exam_repo.list_exams(session, owner_id=user.id)
        cards = [
            StatCard(key="documents", label="Tài liệu của tôi", value=len(documents)),
            StatCard(key="students", label="Sinh viên quản lý", value=len(students)),
            StatCard(key="exams", label="Lịch thi", value=len(exams)),
            StatCard(key="conversations", label="Hội thoại AI của tôi",
                     value=await conversation_repo.count_conversations(session, user_id=user.id)),
        ]
        owner_name = {user.id: user.full_name}
        return StatsOverview(role=role, cards=cards, recent_documents=_recent(documents, owner_name))

    # student (và vai trò khác): tài liệu nhà trường + hội thoại của mình.
    documents = await document_repo.list_documents(session)
    school = [d for d in documents if _doc_meta(d, "scope", "school") == "school"]
    school_ready = [d for d in school if d.status == "ready"]
    cards = [
        StatCard(key="available_documents", label="Tài liệu khả dụng", value=len(school_ready)),
        StatCard(key="conversations", label="Hội thoại của tôi",
                 value=await conversation_repo.count_conversations(session, user_id=user.id)),
    ]
    return StatsOverview(role=role or "student", cards=cards, recent_documents=_recent(school_ready))


async def stats_analytics_controller(session: AsyncSession, user: User, range_key: str = "30d") -> StatsAnalytics:
    """Analytics cho trang admin, tổng hợp trực tiếp từ dữ liệu chat trong DB."""

    now = datetime.utcnow()
    since, range_label, bucket_kind, bucket_count = _analytics_range(range_key)

    runs = await conversation_repo.list_agent_runs_since(session, since)
    conversations_in_range = len({run.conversation_id for run in runs if run.conversation_id})

    completed = [run for run in runs if run.status == "completed" and not run.error]
    failed = [run for run in runs if run.status != "completed" or run.error]
    avg_latency = round(sum(run.latency_ms for run in completed) / len(completed)) if completed else 0
    success_rate = round((len(completed) / len(runs)) * 100, 1) if runs else 0

    unanswered_rows = await conversation_repo.list_unanswered_queries(session, since=since)
    unanswered_total = sum(count for _, count, _ in unanswered_rows)
    unanswered = [
        UnansweredQuestion(
            q=question,
            count=count,
            date=latest.strftime("%d/%m/%Y") if latest else "",
            hot=count >= 3,
        )
        for question, count, latest in unanswered_rows
    ]

    if bucket_kind == "hour3":
        first_hour = now.replace(minute=0, second=0, microsecond=0) - timedelta(hours=23)
        traffic_counts = Counter(
            min(
                7,
                max(
                    0,
                    int(
                        (
                            run.created_at.replace(minute=0, second=0, microsecond=0)
                            - first_hour
                        ).total_seconds()
                        // 3600
                    )
                    // 3,
                ),
            )
            for run in runs
        )
    else:
        traffic_counts = Counter(run.created_at.date() for run in runs)
    traffic = []
    for offset in range(bucket_count):
        if bucket_kind == "hour3":
            start = first_hour + timedelta(hours=offset * 3)
            traffic.append(TrafficPoint(label=_hour_range_label(start), value=traffic_counts[offset]))
        else:
            day = (now - timedelta(days=bucket_count - 1 - offset)).date()
            day_dt = datetime.combine(day, datetime.min.time())
            label = _weekday_label(day_dt) if bucket_count == 7 else _date_label(day_dt)
            traffic.append(TrafficPoint(label=label, value=traffic_counts[day]))

    role_colors = {
        "student": "#1a56db",
        "lecturer": "#10b981",
        "admin": "#6b7280",
        "unknown": "#9ca3af",
    }
    role_rows = await conversation_repo.count_agent_runs_by_role(session, since=since)
    # Aggregate roles, treating "unknown" as "student"
    role_counts = {}
    for role, count in role_rows:
        target_role = "student" if role == "unknown" else role
        role_counts[target_role] = role_counts.get(target_role, 0) + count

    role_total = sum(role_counts.values())
    by_role = [
        RoleBreakdown(
            role=_role_label(role),
            value=count,
            percent=round((count / role_total) * 100) if role_total else 0,
            color=role_colors.get(role, "#9ca3af"),
        )
        for role, count in role_counts.items()
    ]

    topic_colors = ["#1a56db", "#10b981", "#6b7280", "#9ca3af", "#14b8a6"]
    topic_counts = Counter(
        _topic_name(metadata)
        for metadata in await conversation_repo.list_cited_document_metadata(session, since=since)
    )
    topic_total = sum(topic_counts.values())
    topics = [
        TopicInterest(
            name=name,
            count=count,
            percent=round((count / topic_total) * 100) if topic_total else 0,
            color=topic_colors[index % len(topic_colors)],
        )
        for index, (name, count) in enumerate(topic_counts.most_common(5))
    ]

    stats = [
        AnalyticsStat(
            key="queries",
            label="Tổng lượt hỏi AI",
            value=f"{len(runs):,}",
            note=f"{len(runs):,} lượt trong {range_label}",
        ),
        AnalyticsStat(
            key="success_rate",
            label="Tỷ lệ trả lời thành công",
            value=f"{success_rate}%",
            note=f"{len(completed):,}/{len(runs):,} lượt thành công",
        ),
        AnalyticsStat(
            key="unanswered",
            label="Câu hỏi chưa phù hợp",
            value=f"{unanswered_total:,}",
            note="Từ lỗi hoặc phản hồi không có trích dẫn",
            danger=unanswered_total > 0,
        ),
        AnalyticsStat(
            key="latency",
            label="Độ trễ trung bình",
            value=_format_ms(avg_latency),
            note=f"{len(failed):,} lượt lỗi trong {range_label}",
        ),
    ]

    if conversations_in_range:
        stats[0].delta = f"{conversations_in_range:,} hội thoại"
        stats[0].delta_type = "up"

    return StatsAnalytics(
        stats=stats,
        traffic=traffic,
        by_role=by_role,
        unanswered=unanswered,
        topics=topics,
        unanswered_total=unanswered_total,
    )
