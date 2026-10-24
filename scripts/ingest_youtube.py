"""Nạp transcript video YouTube vào RAG (DB + Qdrant) — CHẠY TỪ MÁY CÁ NHÂN.

Dùng khi YouTube chặn IP máy chủ (Render/cloud). Máy cá nhân có IP dân dụng nên lấy
transcript được; script ghi thẳng vào DB + Qdrant cloud đang cấu hình trong .env
(DATABASE_URL/QDRANT_URL/OPENAI_API_KEY) → sản phẩm trên web dùng được ngay.

Usage:
    # 1 video
    python scripts/ingest_youtube.py "https://www.youtube.com/watch?v=XXXX"
    python scripts/ingest_youtube.py "<url>" --owner admin@ai20k.vn --title "Bài giảng 1"

    # NHIỀU video một lần
    python scripts/ingest_youtube.py "<url1>" "<url2>" "<url3>"

    # Đọc danh sách link từ tệp (mỗi dòng 1 link, dòng bắt đầu bằng # bị bỏ qua)
    python scripts/ingest_youtube.py --file links.txt

Lưu ý: trỏ .env vào DB/Qdrant CLOUD (bản production) trước khi chạy.
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.api.controllers.document_controller import register_link_document_controller
from src.db.session import AsyncSessionLocal
from src.repositories import user_repo
from src.services import youtube


def _collect_urls(args: argparse.Namespace) -> list[str]:
    urls = list(args.urls or [])
    if args.file:
        for line in Path(args.file).read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                urls.append(line)
    # bỏ trùng, giữ thứ tự
    seen, out = set(), []
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


async def run(args: argparse.Namespace) -> int:
    urls = _collect_urls(args)
    if not urls:
        print("❌ Chưa có link nào. Truyền link trực tiếp hoặc dùng --file links.txt")
        return 2

    ok = failed = 0
    async with AsyncSessionLocal() as session:
        user = await user_repo.get_by_login(session, args.owner)
        if user is None:
            print(
                f"❌ Không tìm thấy tài khoản '{args.owner}'. Dùng --owner <email>"
                " của một tài khoản admin/giảng viên đang tồn tại."
            )
            return 3

        for i, url in enumerate(urls, start=1):
            prefix = f"[{i}/{len(urls)}]"
            if not youtube.is_youtube_url(url):
                print(f"{prefix} ⏭️  Bỏ qua (không phải link YouTube): {url}")
                failed += 1
                continue
            print(f"{prefix} ⏳ Đang lấy transcript: {url}")
            try:
                response = await register_link_document_controller(
                    session,
                    user,
                    url=url,
                    title=args.title if len(urls) == 1 else None,
                    description=args.description,
                )
            except Exception as exc:  # noqa: BLE001 — 1 video lỗi không dừng cả mẻ
                print(f"{prefix} ❌ Lỗi: {str(exc)[:160]}")
                failed += 1
                continue

            if response.status == "ready" and (response.total_chunks or 0) > 0:
                print(f"{prefix} ✅ '{response.title}' — {response.total_chunks} đoạn (id={response.id})")
                ok += 1
            else:
                print(f"{prefix} ⚠️  Chưa lấy được transcript (status={response.status}).")
                failed += 1

    print(f"\n=== Hoàn tất: {ok} thành công, {failed} lỗi/bỏ qua / tổng {len(urls)} ===")
    return 0 if ok and not failed else (1 if ok else 4)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("urls", nargs="*", help="Một hoặc nhiều link video YouTube")
    parser.add_argument("--file", default=None, help="Tệp chứa danh sách link (mỗi dòng 1 link)")
    parser.add_argument(
        "--owner",
        default="admin@ai20k.vn",
        help="Email/username chủ sở hữu tài liệu (mặc định: admin@ai20k.vn)",
    )
    parser.add_argument("--title", default=None, help="Tiêu đề (chỉ áp dụng khi nạp 1 link)")
    parser.add_argument("--description", default=None, help="Mô tả (tùy chọn)")
    args = parser.parse_args()
    return asyncio.run(run(args))


if __name__ == "__main__":
    raise SystemExit(main())
