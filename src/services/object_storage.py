"""Object storage cho tài liệu gốc — Cloudflare R2 (S3-compatible qua boto3).

Thiết kế "graceful": nếu OBJECT_STORAGE_PROVIDER != "r2" hoặc thiếu credential,
mọi hàm trở thành no-op (trả None) để dev/test chạy được mà không cần R2.

boto3 là sync nên các thao tác I/O được bọc trong asyncio.to_thread.
"""

import asyncio
import mimetypes
from functools import lru_cache
from pathlib import Path

from src.config import get_settings


def is_enabled() -> bool:
    s = get_settings()
    return (
        s.object_storage_provider.lower() == "r2"
        and bool(s.r2_endpoint_url)
        and bool(s.r2_access_key_id)
        and bool(s.r2_secret_access_key)
        and bool(s.r2_bucket_name)
    )


@lru_cache
def _client():
    import boto3
    from botocore.config import Config

    s = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=s.r2_endpoint_url,
        aws_access_key_id=s.r2_access_key_id,
        aws_secret_access_key=s.r2_secret_access_key,
        region_name=s.r2_region or "auto",
        config=Config(signature_version="s3v4"),
    )


def _bucket() -> str:
    return get_settings().r2_bucket_name


async def upload_file(local_path: str | Path, key: str, *, content_type: str | None = None) -> str | None:
    """Đẩy 1 file local lên R2 dưới khóa `key`. Trả về key nếu thành công, None nếu tắt."""
    if not is_enabled():
        return None
    path = str(local_path)
    ctype = content_type or mimetypes.guess_type(path)[0] or "application/octet-stream"

    def _do() -> str:
        _client().upload_file(path, _bucket(), key, ExtraArgs={"ContentType": ctype})
        return key

    return await asyncio.to_thread(_do)


async def download_file(key: str, local_path: str | Path) -> bool:
    """Tải object `key` về `local_path`. Trả về True nếu thành công."""
    if not is_enabled():
        return False
    dest = Path(local_path)
    dest.parent.mkdir(parents=True, exist_ok=True)

    def _do() -> bool:
        _client().download_file(_bucket(), key, str(dest))
        return True

    return await asyncio.to_thread(_do)


async def download_bytes(key: str) -> bytes | None:
    """Tải nội dung object `key` vào bộ nhớ. Trả về bytes, hoặc None nếu tắt/không có."""
    if not is_enabled() or not key:
        return None

    def _do() -> bytes | None:
        try:
            resp = _client().get_object(Bucket=_bucket(), Key=key)
            return resp["Body"].read()
        except Exception:
            return None

    return await asyncio.to_thread(_do)


async def delete_object(key: str) -> bool:
    """Xóa object `key` trên R2. Trả về True nếu đã gọi xóa, False nếu tắt."""
    if not is_enabled() or not key:
        return False

    def _do() -> bool:
        _client().delete_object(Bucket=_bucket(), Key=key)
        return True

    return await asyncio.to_thread(_do)


async def generate_presigned_url(key: str, *, expires_in: int = 3600) -> str | None:
    """Tạo URL tải xuống tạm thời cho object `key`."""
    if not is_enabled() or not key:
        return None

    def _do() -> str:
        return _client().generate_presigned_url(
            "get_object",
            Params={"Bucket": _bucket(), "Key": key},
            ExpiresIn=expires_in,
        )

    return await asyncio.to_thread(_do)
