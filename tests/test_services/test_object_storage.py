from types import SimpleNamespace

import pytest

from src.services import object_storage, task_queue


def _settings(**kw):
    base = dict(
        object_storage_provider="local",
        r2_endpoint_url="",
        r2_access_key_id="",
        r2_secret_access_key="",
        r2_bucket_name="",
        r2_region="auto",
        redis_url="redis://localhost:6379/0",
    )
    base.update(kw)
    return SimpleNamespace(**base)


def test_is_enabled_false_when_local(monkeypatch):
    monkeypatch.setattr(object_storage, "get_settings", lambda: _settings())
    assert object_storage.is_enabled() is False


def test_is_enabled_true_when_r2_configured(monkeypatch):
    monkeypatch.setattr(
        object_storage,
        "get_settings",
        lambda: _settings(
            object_storage_provider="r2",
            r2_endpoint_url="https://x.r2.cloudflarestorage.com",
            r2_access_key_id="k",
            r2_secret_access_key="s",
            r2_bucket_name="b",
        ),
    )
    assert object_storage.is_enabled() is True


@pytest.mark.asyncio
async def test_upload_noop_when_disabled(monkeypatch):
    monkeypatch.setattr(object_storage, "get_settings", lambda: _settings())
    assert await object_storage.upload_file("/tmp/whatever.txt", "k") is None


@pytest.mark.asyncio
async def test_delete_and_presign_noop_when_disabled(monkeypatch):
    monkeypatch.setattr(object_storage, "get_settings", lambda: _settings())
    assert await object_storage.delete_object("k") is False
    assert await object_storage.generate_presigned_url("k") is None


@pytest.mark.asyncio
async def test_enqueue_returns_none_when_redis_down(monkeypatch):
    async def boom(*args, **kwargs):
        raise ConnectionError("no redis")

    monkeypatch.setattr(task_queue, "create_pool", boom)
    monkeypatch.setattr(task_queue, "get_redis_settings", lambda: None)
    assert await task_queue.enqueue_ingest({"path": "x"}) is None
