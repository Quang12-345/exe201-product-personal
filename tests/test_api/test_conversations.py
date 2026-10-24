from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from src.api.controllers import conversation_controller as cc
from src.api.controllers import stats_controller as sc


def _user(role, uid):
    return SimpleNamespace(id=uid, full_name=role.title(), role=SimpleNamespace(name=role))


# ----- Route auth -----

@pytest.mark.asyncio
async def test_conversations_requires_auth(client):
    assert (await client.get("/api/v1/conversations")).status_code == 401


@pytest.mark.asyncio
async def test_stats_requires_auth(client):
    assert (await client.get("/api/v1/stats/overview")).status_code == 401


# ----- Conversation ownership -----

@pytest.mark.asyncio
async def test_get_messages_forbidden_for_other_owner(monkeypatch):
    async def fake_get(session, cid):
        return SimpleNamespace(id=cid, user_id="someone-else")

    monkeypatch.setattr(cc.conversation_repo, "get_conversation", fake_get)
    with pytest.raises(HTTPException) as exc:
        await cc.get_messages_controller(None, _user("student", "s1"), "c1")
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_get_messages_404_when_missing(monkeypatch):
    async def fake_get(session, cid):
        return None

    monkeypatch.setattr(cc.conversation_repo, "get_conversation", fake_get)
    with pytest.raises(HTTPException) as exc:
        await cc.get_messages_controller(None, _user("student", "s1"), "missing")
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_admin_can_read_any_conversation(monkeypatch):
    async def fake_get(session, cid):
        return SimpleNamespace(id=cid, user_id="other")

    async def fake_list_messages(session, cid):
        return [
            SimpleNamespace(id="m1", role="user", content="hỏi", metadata_json={}, created_at=datetime.now()),
            SimpleNamespace(
                id="m2", role="assistant", content="đáp",
                metadata_json={"sources": [{"document_id": "d", "title": "T", "chunk_id": "c", "score": 0.9, "cite": 1}]},
                created_at=datetime.now(),
            ),
        ]

    monkeypatch.setattr(cc.conversation_repo, "get_conversation", fake_get)
    monkeypatch.setattr(cc.conversation_repo, "list_messages", fake_list_messages)
    items = await cc.get_messages_controller(None, _user("admin", "a1"), "c1")
    assert len(items) == 2
    assert items[1].sources[0].cite == 1


# ----- Stats role-aware -----

@pytest.mark.asyncio
async def test_stats_admin_cards(monkeypatch):
    async def alist(session):
        return []

    monkeypatch.setattr(sc.user_repo, "list_all", alist)
    monkeypatch.setattr(sc.document_repo, "list_documents", alist)

    async def count_conv(session, *, user_id=None):
        return 3

    async def count_runs(session):
        return 7

    monkeypatch.setattr(sc.conversation_repo, "count_conversations", count_conv)
    monkeypatch.setattr(sc.conversation_repo, "count_agent_runs", count_runs)

    res = await sc.stats_overview_controller(None, _user("admin", "a1"))
    keys = {c.key for c in res.cards}
    assert keys == {"users", "documents", "conversations", "queries"}


@pytest.mark.asyncio
async def test_stats_student_cards(monkeypatch):
    async def alist(session):
        return []

    async def count_conv(session, *, user_id=None):
        return 2

    monkeypatch.setattr(sc.document_repo, "list_documents", alist)
    monkeypatch.setattr(sc.conversation_repo, "count_conversations", count_conv)

    res = await sc.stats_overview_controller(None, _user("student", "s1"))
    keys = {c.key for c in res.cards}
    assert keys == {"available_documents", "conversations"}
    assert res.role == "student"
