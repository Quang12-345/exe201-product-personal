"""Gợi ý tiêu đề/mô tả cho tệp phải TỨC THÌ: không đọc nội dung tệp, không gọi LLM."""

from pathlib import Path

import pytest

from src.services import metadata_suggester


@pytest.mark.asyncio
async def test_suggest_for_file_uses_filename_without_reading_content(monkeypatch):
    # Nếu có gọi LLM → coi như sai (bước này phải tức thì).
    def _boom():
        raise AssertionError("Không được gọi LLM khi gợi ý từ tên tệp")

    monkeypatch.setattr(metadata_suggester, "get_llm", _boom)

    meta = await metadata_suggester.suggest_metadata_for_file(
        Path("/khong/ton/tai/bai_giang_co_so_du_lieu.pdf"),
        "bai_giang_co_so_du_lieu.pdf",
    )

    assert meta["title"] == "Bai Giang Co So Du Lieu"
    # Mô tả suy ra từ tiêu đề.
    assert meta["title"] in meta["description"]


@pytest.mark.asyncio
async def test_suggest_for_file_empty_name_has_safe_fallback():
    meta = await metadata_suggester.suggest_metadata_for_file(Path("x"), "")
    assert meta["title"]  # luôn có tiêu đề mặc định, không rỗng
