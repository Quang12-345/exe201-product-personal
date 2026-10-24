"""Sinh ERD (sơ đồ quan hệ thực thể) TỪ DATABASE PostgreSQL thực tế.

Đọc information_schema của DB đang cấu hình (.env) → xuất sơ đồ Mermaid `erDiagram`
ra docs/erd.md. Mở file đó bằng VS Code (extension Mermaid) hoặc dán vào
https://mermaid.live để xem trực quan. Luôn khớp với DB thật vì đọc trực tiếp từ DB.

Usage:
    python scripts/generate_erd.py            # ghi docs/erd.md
    python scripts/generate_erd.py --print     # in ra màn hình
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text

from src.db.session import AsyncSessionLocal

_TYPE_MAP = {
    "character varying": "string",
    "text": "text",
    "integer": "int",
    "bigint": "bigint",
    "boolean": "bool",
    "double precision": "float",
    "real": "float",
    "numeric": "decimal",
    "timestamp without time zone": "datetime",
    "timestamp with time zone": "datetime",
    "json": "json",
    "jsonb": "json",
    "uuid": "uuid",
}


def _mtype(sql_type: str) -> str:
    return _TYPE_MAP.get(sql_type, sql_type.replace(" ", "_"))


async def _fetch_schema(session) -> tuple[dict, list]:
    tables = (await session.execute(text("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"""))).scalars().all()

    cols_rows = (await session.execute(text("""
        SELECT table_name, column_name, data_type, is_nullable
        FROM information_schema.columns WHERE table_schema='public'
        ORDER BY table_name, ordinal_position"""))).all()

    pk_rows = (await session.execute(text("""
        SELECT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name
        WHERE tc.constraint_type='PRIMARY KEY' AND tc.table_schema='public'"""))).all()
    pks = {(r.table_name, r.column_name) for r in pk_rows}

    fk_rows = (await session.execute(text("""
        SELECT tc.table_name AS src, kcu.column_name AS col,
               ccu.table_name AS ref, rc.delete_rule AS on_delete
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name=ccu.constraint_name
        JOIN information_schema.referential_constraints rc ON tc.constraint_name=rc.constraint_name
        WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
        ORDER BY src, col"""))).all()
    fk_cols = {(r.src, r.col): r for r in fk_rows}

    schema = {t: [] for t in tables}
    for r in cols_rows:
        if r.table_name not in schema:
            continue
        is_pk = (r.table_name, r.column_name) in pks
        is_fk = (r.table_name, r.column_name) in fk_cols
        key = "PK" if is_pk else "FK" if is_fk else ""
        schema[r.table_name].append((r.column_name, _mtype(r.data_type), key))
    return schema, fk_rows


def _to_mermaid(schema: dict, fks: list) -> str:
    lines = ["```mermaid", "erDiagram"]
    # Quan hệ: parent ||--o{ child : "cột (ON DELETE ...)"
    for r in fks:
        rel = f'{r.ref} ||--o{{ {r.src} : "{r.col} · {r.on_delete}"'
        lines.append(f"  {rel}")
    lines.append("")
    # Thực thể + cột
    for table, cols in schema.items():
        lines.append(f"  {table} {{")
        for name, typ, key in cols:
            suffix = f" {key}" if key else ""
            lines.append(f"    {typ} {name}{suffix}")
        lines.append("  }")
    lines.append("```")
    return "\n".join(lines)


def _summary(schema: dict, fks: list) -> str:
    out = [
        "# ERD — Sơ đồ quan hệ Database (C2-App-142)",
        "",
        f"_Sinh tự động từ DB PostgreSQL thực tế bằng `scripts/generate_erd.py` — "
        f"{len(schema)} bảng, {len(fks)} khóa ngoại._",
        "",
        "> Xem trực quan: mở file này trong VS Code (extension *Markdown Preview Mermaid*) "
        "hoặc dán khối mermaid vào https://mermaid.live . "
        "Trên PostgreSQL: pgAdmin → chuột phải database → **ERD For Database**.",
        "",
    ]
    out.append(_to_mermaid(schema, fks))
    out.append("")
    out.append("## Danh sách khóa ngoại")
    out.append("")
    out.append("| Bảng nguồn | Cột | → Bảng đích | ON DELETE |")
    out.append("|---|---|---|---|")
    for r in sorted(fks, key=lambda x: (x.src, x.col)):
        out.append(f"| {r.src} | {r.col} | {r.ref} | {r.on_delete} |")
    return "\n".join(out) + "\n"


async def run(args) -> int:
    async with AsyncSessionLocal() as session:
        schema, fks = await _fetch_schema(session)
    content = _summary(schema, fks)
    if args.print:
        print(content)
        return 0
    out = Path(__file__).resolve().parents[1] / "docs" / "erd.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(content, encoding="utf-8")
    print(f"✅ Đã ghi ERD: {out}  ({len(schema)} bảng, {len(fks)} khóa ngoại)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--print", action="store_true", help="In ra màn hình thay vì ghi file")
    return asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())
