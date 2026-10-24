"""Schemas cho thống kê realtime của dashboard (theo vai trò)."""

from datetime import datetime

from pydantic import BaseModel, Field


class StatCard(BaseModel):
    key: str
    label: str
    value: int
    note: str | None = None


class RecentDocument(BaseModel):
    id: str
    title: str
    subject: str | None = None
    category: str | None = None
    status: str
    owner_name: str | None = None
    created_at: datetime | None = None


class StatsOverview(BaseModel):
    role: str
    cards: list[StatCard] = Field(default_factory=list)
    recent_documents: list[RecentDocument] = Field(default_factory=list)


class AnalyticsStat(BaseModel):
    key: str
    label: str
    value: int | float | str
    note: str | None = None
    delta: str | None = None
    delta_type: str | None = None
    danger: bool = False


class TrafficPoint(BaseModel):
    label: str
    value: int


class RoleBreakdown(BaseModel):
    role: str
    value: int
    percent: int
    color: str


class UnansweredQuestion(BaseModel):
    q: str
    count: int
    date: str
    action: str = "Xem"
    hot: bool = False


class TopicInterest(BaseModel):
    name: str
    percent: int
    count: int
    color: str


class StatsAnalytics(BaseModel):
    stats: list[AnalyticsStat] = Field(default_factory=list)
    traffic: list[TrafficPoint] = Field(default_factory=list)
    by_role: list[RoleBreakdown] = Field(default_factory=list)
    unanswered: list[UnansweredQuestion] = Field(default_factory=list)
    topics: list[TopicInterest] = Field(default_factory=list)
    unanswered_total: int = 0
