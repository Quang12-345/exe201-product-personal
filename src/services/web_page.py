"""Đọc nội dung TRANG WEB (link thường, không phải YouTube) và nạp vào RAG.

Khi người dùng thêm 1 liên kết web vào kho tài liệu, service này tải trang, trích
xuất tiêu đề (ưu tiên h1) + mô tả + nội dung chính rồi tạo chunks → embed → Qdrant để
chatbot trả lời được, và tab "Nội dung" hiển thị đúng nội dung trang.

Best-effort: trang SPA (render bằng JS) có thể chỉ lấy được tiêu đề/mô tả (og:* / meta)
— vẫn lưu để chatbot biết trang nói về gì.
"""

from __future__ import annotations

import re
from uuid import NAMESPACE_URL, uuid5

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from src.repositories import document_repo
from src.services.embeddings import embed_documents
from src.services.vector_store import upsert_chunks

_UA = "Mozilla/5.0 (compatible; AI20K-Bot/1.0)"


def _meta(soup, *keys: str) -> str:
    """Lấy nội dung <meta name=.. / property=..> đầu tiên khớp."""
    for key in keys:
        tag = soup.find("meta", attrs={"property": key}) or soup.find("meta", attrs={"name": key})
        if tag and (tag.get("content") or "").strip():
            return tag["content"].strip()
    return ""


def _strip_sitename(title: str) -> str:
    """Bỏ phần " | Tên site" / " - Tên site" cuối tiêu đề trang cho gọn."""
    return re.split(r"\s+[|\-–—:·]\s+", title.strip())[0].strip() if title else ""


async def fetch_web_page(url: str) -> dict:
    """Tải + trích xuất {title, h1, description, text, page_title}. Lỗi → các trường rỗng."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            resp = await client.get(url, headers={"User-Agent": _UA})
            resp.raise_for_status()
            html = resp.text
    except Exception:
        return {"title": "", "h1": "", "description": "", "text": "", "page_title": ""}

    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")
        page_title = (soup.title.string if soup.title else "") or ""
        page_title = page_title.strip()
        og_title = _meta(soup, "og:title", "twitter:title")
        h1_tag = soup.find("h1")
        h1 = h1_tag.get_text(" ", strip=True) if h1_tag else ""
        description = _meta(soup, "description", "og:description", "twitter:description")

        # Tiêu đề: ưu tiên H1 (theo yêu cầu) → og:title → <title> (đã bỏ tên site).
        title = h1 or og_title or _strip_sitename(page_title)

        # Nội dung chính: bỏ các khối không phải nội dung, ưu tiên <main>/<article>.
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "noscript", "svg"]):
            tag.decompose()
        main = soup.find("main") or soup.find("article") or soup.body or soup
        body = re.sub(r"[ \t]+", " ", main.get_text("\n")).strip()
        body = re.sub(r"\n\s*\n\s*\n+", "\n\n", body)  # gộp dòng trống thừa
        return {
            "title": title.strip(),
            "h1": h1.strip(),
            "description": description.strip(),
            "text": body.strip(),
            "page_title": page_title,
        }
    except Exception:
        return {"title": "", "h1": "", "description": "", "text": "", "page_title": ""}


def build_web_chunks(text: str, *, max_chars: int = 1000) -> list[str]:
    """Cắt nội dung trang thành đoạn ~max_chars theo ranh giới đoạn văn."""
    paragraphs = [p.strip() for p in re.split(r"\n{2,}", text or "") if p.strip()]
    chunks: list[str] = []
    buf = ""
    for para in paragraphs:
        if buf and len(buf) + len(para) + 2 > max_chars:
            chunks.append(buf.strip())
            buf = ""
        buf = f"{buf}\n\n{para}" if buf else para
        while len(buf) > max_chars:  # đoạn quá dài → cắt cứng
            chunks.append(buf[:max_chars].strip())
            buf = buf[max_chars:]
    if buf.strip():
        chunks.append(buf.strip())
    return chunks


async def _ai_description(title: str, text: str) -> str:
    """Nhờ LLM viết mô tả gọn, đẹp cho trang web (soft-fail → "")."""
    from src.services.metadata_suggester import _ask_llm

    content = "\n\n".join(p for p in [title, text] if p)
    if not content.strip():
        return ""
    result = await _ask_llm(f"Trang web: {title}", content, fallback_title=title)
    return result.get("description", "")


async def ingest_web_page(
    session: AsyncSession,
    document,
    url: str,
    *,
    scope: str,
    owner_id: str | None,
    category: str,
) -> dict:
    """Tải trang → trích nội dung → chunks → embed → Qdrant; đặt tiêu đề (h1) + mô tả (AI).

    Trả {chunks, points}. chunks=0 nếu không trích được nội dung (chatbot không đọc được).
    """
    page = await fetch_web_page(url)

    # Nội dung cho RAG: tiêu đề + mô tả + thân trang.
    full = "\n\n".join(p for p in [page["title"], page["description"], page["text"]] if p).strip()
    raw_chunks = build_web_chunks(full)

    # Đặt tiêu đề (ưu tiên h1) + mô tả AI vào tài liệu.
    md = dict(document.metadata_json or {})
    md["kind"] = "web"
    # Đặt tiêu đề = h1/title trang khi chưa có tiêu đề riêng (đang là URL/trống).
    if page["title"] and (not document.title or document.title.strip().startswith("http")):
        document.title = page["title"][:300]
    description = await _ai_description(page["title"], page["text"]) or page["description"]
    if description:
        md["description"] = description[:500]
    await document_repo.update_document_metadata(session, document, md)

    if not raw_chunks:
        # Không trích được nội dung (vd SPA chặn): vẫn để 'ready' nhưng không có chunk.
        await session.commit()
        return {"chunks": 0, "points": 0}

    chunk_dicts = []
    for index, content in enumerate(raw_chunks):
        chunk_dicts.append(
            {
                "chunk_index": index,
                "content": content,
                "page_number": None,
                "token_count": len(content.split()),
                "qdrant_point_id": str(uuid5(NAMESPACE_URL, f"{document.id}:{index}")),
                "metadata": {
                    "kind": "web",
                    "url": url,
                    "section_title": page["title"] or url,
                },
            }
        )

    db_chunks = await document_repo.replace_document_chunks(
        session, document_id=document.id, chunks=chunk_dicts
    )
    await session.commit()

    vectors = await embed_documents([c.content for c in db_chunks])
    points = await upsert_chunks(
        vectors=vectors,
        chunks=[
            {
                "qdrant_point_id": c.qdrant_point_id,
                "chunk_id": c.id,
                "document_id": document.id,
                "title": document.title,
                "page_number": c.page_number,
                "file_type": "link",
                "scope": scope,
                "owner_id": owner_id or "",
                "category": category,
                "metadata": c.metadata_json,
            }
            for c in db_chunks
        ],
    )
    await document_repo.mark_document_ready(
        session, document, total_pages=0, total_chunks=len(db_chunks)
    )
    await session.commit()
    return {"chunks": len(db_chunks), "points": points}
