import unicodedata
from pathlib import Path
from types import SimpleNamespace

import pytest

from src.services import ingestion
from src.services.data_pipeline import (
    DoclingConversion,
    DuplicateDatasetFileError,
    ValidatedDocument,
    build_document_metadata,
    calculate_sha256,
    chunk_clean_markdown,
    clean_markdown,
    collect_dataset_documents,
    detect_language,
    process_document_for_rag,
    validate_document_file,
)


def test_validate_document_file_rejects_unsupported_file(tmp_path):
    archive_file = tmp_path / "notes.zip"
    archive_file.write_bytes(b"PK\x03\x04 not a document")

    with pytest.raises(ValueError, match="Only document files"):
        validate_document_file(archive_file)


def test_validate_document_file_accepts_supported_formats(tmp_path):
    for suffix in [".pdf", ".docx", ".pptx"]:
        document_file = tmp_path / f"sample{suffix}"
        document_file.write_bytes(b"document")

        validated = validate_document_file(document_file)

        assert validated.file_path == document_file


def test_collect_dataset_documents_keeps_supported_formats(tmp_path):
    for name in ["a.pdf", "b.docx", "c.pptx", "d.txt", "e.zip"]:
        (tmp_path / name).write_bytes(b"document")

    files = collect_dataset_documents(tmp_path)

    # .zip không được hỗ trợ nên bị loại; .txt nay được hỗ trợ.
    assert [path.name for path in files] == ["a.pdf", "b.docx", "c.pptx", "d.txt"]


def test_validate_document_file_rejects_large_file(tmp_path):
    pdf_file = tmp_path / "large.pdf"
    pdf_file.write_bytes(b"x" * 11)

    with pytest.raises(ValueError, match="exceeds"):
        validate_document_file(pdf_file, max_file_size_bytes=10)


def test_validate_document_file_hash_and_duplicate_detection(tmp_path):
    pdf_one = tmp_path / "one.pdf"
    pdf_two = tmp_path / "two.pdf"
    pdf_one.write_bytes(b"%PDF-1.4\nsame content")
    pdf_two.write_bytes(b"%PDF-1.4\nsame content")

    seen_hashes = {}
    validated = validate_document_file(pdf_one, seen_hashes=seen_hashes)

    assert validated.file_hash == calculate_sha256(pdf_one)
    with pytest.raises(DuplicateDatasetFileError):
        validate_document_file(pdf_two, seen_hashes=seen_hashes)


def test_clean_markdown_removes_noise_and_preserves_structure():
    markdown = """
Repeated Header
1
# Title
This is a hyphen-
ated paragraph with Vietnamese tiếng Việt.

| A | B |
| - | - |
| x | y |

```python
print("hello")
```

Repeated Header
Repeated Header
"""

    cleaned = clean_markdown(markdown)

    assert "Repeated Header" not in cleaned
    assert "hyphenated paragraph" in cleaned
    assert "# Title" in cleaned
    assert "| x | y |" in cleaned
    assert 'print("hello")' in cleaned
    assert "tiếng Việt" in cleaned


def test_build_document_metadata_extracts_sections_and_fallback(tmp_path):
    pdf_file = tmp_path / "sample.pdf"
    pdf_file.write_bytes(b"%PDF-1.4\nsample")
    validation = ValidatedDocument(
        file_path=pdf_file,
        file_hash="abc123",
        file_size_bytes=pdf_file.stat().st_size,
        document_key="sample-abc123",
    )
    converted = _converted(
        tmp_path,
        markdown="# Intro\nUseful content",
        metadata={
            "page_count": 2,
            "table_of_contents": [
                {"title": "Intro", "heading_level": 1, "page_id": 0}
            ],
        },
    )

    metadata = build_document_metadata(
        validation=validation,
        converted=converted,
        clean_markdown_text="# Intro\nUseful content",
        processed_dir=tmp_path,
        dataset_name="docs",
    )

    assert metadata["page_count"] == 2
    assert metadata["section_count"] == 1
    assert metadata["language"] == "en"
    assert metadata["parser"] == "docling"
    assert metadata["pipeline_version"] == "docling-v1"
    assert metadata["file_type"] == "pdf"
    assert metadata["sections"][0]["title"] == "Intro"
    assert metadata["extraction_metadata"]["block_counts"]["Page"] == 1
    assert metadata["extraction_metadata"]["image_paths"] == ["images/page-001.png"]


def test_chunk_clean_markdown_respects_sections_and_preserves_table(tmp_path):
    markdown = """
# Intro
alpha beta gamma delta epsilon zeta eta theta iota kappa

| A | B |
| - | - |
| x | y |

## Details
one two three four five six seven eight nine ten
"""
    metadata = {
        "page_count": 2,
        "sections": [
            {"title": "Intro", "heading_level": 1, "page_start": 1},
            {"title": "Details", "heading_level": 2, "page_start": 2},
        ],
    }

    chunks = chunk_clean_markdown(
        clean_markdown(markdown),
        marker_json=[{"block_type": "Page", "children": [{"block_type": "Text"}]}],
        document_metadata=metadata,
        model_name="text-embedding-3-small",
        source_markdown_path=tmp_path / "clean.md",
        chunk_size=30,
        chunk_overlap=5,
    )

    assert chunks
    assert all(chunk.token_count <= 30 for chunk in chunks)
    assert {chunk.metadata["section_title"] for chunk in chunks} == {"Intro", "Details"}
    table_chunks = [chunk for chunk in chunks if "| A | B |" in chunk.content]
    assert table_chunks
    assert "| x | y |" in table_chunks[0].content


def test_process_document_for_rag_writes_artifacts_and_chunks(tmp_path):
    pdf_file = tmp_path / "sample.pdf"
    pdf_file.write_bytes(b"%PDF-1.4\nsample")

    processed = process_document_for_rag(
        pdf_file,
        processed_root=tmp_path / "processed",
        model_name="text-embedding-3-small",
        docling_runner=_fake_docling_runner,
    )

    assert processed.raw_markdown_path.exists()
    assert processed.raw_json_path.exists()
    assert processed.raw_json_path.name == "docling.json"
    assert processed.clean_markdown_path.exists()
    assert processed.metadata_path.exists()
    assert processed.report_path.exists()
    assert processed.document_metadata["parser"] == "docling"
    assert processed.chunks


@pytest.mark.asyncio
async def test_ingest_document_file_uses_processed_chunks_and_vector_payload(tmp_path, monkeypatch):
    pdf_file = tmp_path / "sample.pdf"
    pdf_file.write_bytes(b"%PDF-1.4\nsample")
    fake_document = SimpleNamespace(
        id="doc-1",
        title="Sample",
        file_type="pdf",
        metadata_json={},
    )
    captured = {}

    async def fake_upsert_document(session, *, title, file_path, metadata, uploaded_by=None):
        captured["initial_metadata"] = metadata
        return fake_document

    async def fake_update_document_metadata(session, document, metadata):
        captured["document_metadata"] = metadata
        document.metadata_json = metadata

    async def fake_replace_document_chunks(session, *, document_id, chunks):
        captured["chunks"] = chunks
        return [
            SimpleNamespace(
                id=f"chunk-{index}",
                qdrant_point_id=chunk["qdrant_point_id"],
                page_number=chunk["page_number"],
                metadata_json=chunk["metadata"],
                content=chunk["content"],
            )
            for index, chunk in enumerate(chunks)
        ]

    async def fake_mark_document_ready(session, document, *, total_pages, total_chunks):
        captured["ready"] = (total_pages, total_chunks)

    async def fake_embed_documents(texts):
        captured["embedded_texts"] = texts
        return [[0.1, 0.2] for _ in texts]

    async def fake_upsert_chunks(*, vectors, chunks):
        captured["vectors"] = vectors
        captured["vector_chunks"] = chunks
        return len(chunks)

    async def fake_get_document_by_storage_path(session, storage_path):
        return None

    async def fake_get_document(session, document_id):
        return fake_document

    monkeypatch.setattr(
        ingestion.document_repo,
        "get_document_by_storage_path",
        fake_get_document_by_storage_path,
    )
    monkeypatch.setattr(ingestion.document_repo, "get_document", fake_get_document)
    monkeypatch.setattr(ingestion.document_repo, "upsert_document", fake_upsert_document)
    monkeypatch.setattr(
        ingestion.document_repo,
        "update_document_metadata",
        fake_update_document_metadata,
    )
    monkeypatch.setattr(
        ingestion.document_repo,
        "replace_document_chunks",
        fake_replace_document_chunks,
    )
    monkeypatch.setattr(ingestion.document_repo, "mark_document_ready", fake_mark_document_ready)
    monkeypatch.setattr(ingestion, "embed_documents", fake_embed_documents)
    monkeypatch.setattr(ingestion, "upsert_chunks", fake_upsert_chunks)

    class FakeSession:
        async def commit(self):
            return None
        async def close(self):
            return None

    stats = await ingestion.ingest_document_file(
        FakeSession(),
        pdf_file,
        processed_root=tmp_path / "processed",
        docling_runner=_fake_docling_runner,
    )

    assert stats["documents"] == 1
    assert stats["points"] == len(captured["chunks"])
    assert captured["initial_metadata"]["processing_status"] == "processing"
    assert captured["initial_metadata"]["parser"] == "docling"
    assert captured["document_metadata"]["processing_status"] == "ready"
    assert captured["chunks"][0]["metadata"]["section_title"] == "Intro"
    assert captured["vector_chunks"][0]["metadata"]["file_hash"]


@pytest.mark.asyncio
async def test_ingest_dataset_collects_pdf_docx_and_pptx(tmp_path, monkeypatch):
    for name in ["a.pdf", "b.docx", "c.pptx", "d.txt", "e.zip"]:
        (tmp_path / name).write_bytes(b"document")

    captured_files = []

    async def fake_init_db():
        return None

    async def fake_ingest_document_file(session, document_file, *, dataset_name, seen_hashes, force=False):
        captured_files.append(document_file.name)
        return {
            "documents": 1,
            "chunks": 2,
            "points": 2,
            "failed_documents": 0,
            "skipped_documents": 0,
        }

    monkeypatch.setattr(ingestion, "init_db", fake_init_db)
    monkeypatch.setattr(ingestion, "ingest_document_file", fake_ingest_document_file)

    stats = await ingestion.ingest_dataset(object(), dataset_dir=tmp_path)

    # .zip bị loại; .txt nay được hỗ trợ.
    assert captured_files == ["a.pdf", "b.docx", "c.pptx", "d.txt"]
    assert stats["documents"] == 4
    assert stats["chunks"] == 8
    assert stats["points"] == 8


def _fake_docling_runner(file_path: Path, processed_dir: Path) -> DoclingConversion:
    return DoclingConversion(
        markdown="# Intro\n\nUseful RAG text from the converted PDF.",
        json_data=[{"block_type": "Page", "children": [{"block_type": "Text"}]}],
        metadata={
            "page_count": 1,
            "table_of_contents": [
                {"title": "Intro", "heading_level": 1, "page_id": 0}
            ],
            "image_paths": ["images/page-001.png"],
        },
        image_paths=["images/page-001.png"],
    )


def _converted(
    tmp_path: Path,
    *,
    markdown: str,
    metadata: dict,
) -> SimpleNamespace:
    return SimpleNamespace(
        raw_markdown_path=tmp_path / "raw.md",
        raw_json_path=tmp_path / "docling.json",
        docling_metadata_path=tmp_path / "docling_metadata.json",
        markdown=markdown,
        json_data=[{"block_type": "Page", "children": [{"block_type": "Text"}]}],
        metadata=metadata,
        image_paths=["images/page-001.png"],
    )


def test_clean_markdown_normalization_and_formatting():
    # 1. Unicode NFC normalization: decomposed Vietnamese a + ` (NFD) -> composed à (NFC)
    decomposed = "a\u0300"
    composed = unicodedata.normalize("NFC", decomposed)
    assert clean_markdown(decomposed) == composed

    # 2. HTML Entity Unescaping
    html_input = "Hello &amp; welcome &lt;here&gt; &quot;friend&quot;"
    assert clean_markdown(html_input) == 'Hello & welcome <here> "friend"'

    # 3. Underscore Escape Cleaning
    escaped_underscores = "api\\_host = \\_\\_init\\_\\_"
    assert clean_markdown(escaped_underscores) == "api_host = __init__"

    # 4. Spacing normalization around punctuation
    bad_spacing = "Hello ,world . This is a test;no space after:and before : punctuation!"
    cleaned_spacing = clean_markdown(bad_spacing)
    # spaces before punctuation are removed, spaces after are added where appropriate
    assert "Hello, world." in cleaned_spacing
    assert "test; no space" in cleaned_spacing
    assert "after: and before: punctuation!" in cleaned_spacing

    # 5. Empty/malformed code blocks
    malformed_code = """
Intro text.

```
Shell
```

```python

```

More text.
"""
    cleaned_code = clean_markdown(malformed_code)
    assert "Shell" not in cleaned_code
    assert "```python" not in cleaned_code


def test_clean_markdown_strips_image_links_without_gluing_lines():
    markdown = (
        "## Tại sao cần học Logical Thinking?\n"
        "\n"
        "![Image](data/processed/sample-abc/images/image_000001_deadbeef.png)\n"
        "\n"
        "Tư duy logic là nền tảng quan trọng.\n"
        "\n"
        "![Image](images/image_000002_cafebabe.png)\n"
    )

    cleaned = clean_markdown(markdown)

    assert "[Image](" not in cleaned
    assert "! [" not in cleaned
    assert "## Tại sao cần học Logical Thinking?" in cleaned
    assert "Tư duy logic là nền tảng quan trọng." in cleaned


def test_clean_markdown_keeps_urls_intact():
    cleaned = clean_markdown("Xem thêm tại https://example.com/docs?id=1 nhé.")

    assert "https://example.com/docs?id=1" in cleaned


def test_chunk_clean_markdown_merges_tiny_heading_chunks(tmp_path):
    markdown = (
        "# Slide Title Only\n"
        "\n"
        "## Nội dung chính\n"
        "Tư duy logic và kỹ năng giải quyết vấn đề là nền tảng quan trọng "
        "giúp xử lý vấn đề phức tạp và tối ưu nguồn lực đầu tư.\n"
    )

    chunks = chunk_clean_markdown(
        markdown,
        marker_json=[],
        document_metadata={"page_count": 1, "sections": []},
        model_name="text-embedding-3-small",
        source_markdown_path=tmp_path / "clean.md",
        chunk_size=900,
        chunk_overlap=120,
        min_chunk_tokens=30,
    )

    assert len(chunks) == 1
    assert "# Slide Title Only" in chunks[0].content
    assert "Nội dung chính" in chunks[0].content


@pytest.mark.asyncio
async def test_ingest_document_file_skips_unchanged_ready_document(tmp_path, monkeypatch):
    pdf_file = tmp_path / "sample.pdf"
    pdf_file.write_bytes(b"%PDF-1.4\nsample")
    file_hash = calculate_sha256(pdf_file)
    existing_document = SimpleNamespace(
        id="doc-1",
        status="ready",
        total_chunks=3,
        metadata_json={"file_hash": file_hash, "pipeline_version": "docling-v1"},
    )

    async def fake_get_document_by_storage_path(session, storage_path):
        return existing_document

    async def fake_count_points_for_document(document_id):
        return 3

    monkeypatch.setattr(
        ingestion.document_repo,
        "get_document_by_storage_path",
        fake_get_document_by_storage_path,
    )
    monkeypatch.setattr(ingestion, "count_points_for_document", fake_count_points_for_document)

    stats = await ingestion.ingest_document_file(object(), pdf_file)

    assert stats["skipped_documents"] == 1
    assert stats["documents"] == 0


@pytest.mark.asyncio
async def test_cleanup_missing_documents_removes_docs_without_source_file(tmp_path, monkeypatch):
    existing_file = tmp_path / "still-here.pdf"
    existing_file.write_bytes(b"%PDF-1.4")
    kept = SimpleNamespace(id="doc-kept", storage_path=str(existing_file))
    stale = SimpleNamespace(id="doc-stale", storage_path=str(tmp_path / "deleted.pdf"))
    deleted = []

    async def fake_list_documents(session):
        return [kept, stale]

    async def fake_delete_document(session, document):
        deleted.append(document.id)

    async def fake_delete_points_for_document(document_id):
        deleted.append(f"points:{document_id}")

    monkeypatch.setattr(ingestion.document_repo, "list_documents", fake_list_documents)
    monkeypatch.setattr(ingestion.document_repo, "delete_document", fake_delete_document)
    monkeypatch.setattr(ingestion, "delete_points_for_document", fake_delete_points_for_document)

    class FakeSession:
        async def commit(self):
            return None

    removed = await ingestion._cleanup_missing_documents(FakeSession())

    assert removed == 1
    assert deleted == ["points:doc-stale", "doc-stale"]


def test_detect_language_improved():
    vietnamese_text = "Tư duy logic và kỹ năng giải quyết vấn đề là nền tảng quan trọng giúp xử lý vấn đề phức tạp, tối ưu nguồn lực và đảm bảo hiệu quả đầu tư trong lĩnh vực AI."
    english_text = "This cookbook outlines the technical specifications and implementation details for the Gemini Live API in Vertex AI. The Live API is designed to enable low-latency, real-time voice and video interactions, processing continuous streams of input."

    assert detect_language(vietnamese_text) == "vi"
    assert detect_language(english_text) == "en"


def test_extract_sections_and_tables_images_from_docling_json(tmp_path):
    mock_docling_json = {
        "schema_name": "DoclingDocument",
        "version": "1.10.0",
        "texts": [
            {
                "label": "section_header",
                "text": "Deep Learning Foundation",
                "level": 1,
                "prov": [{"page_no": 5}]
            },
            {
                "label": "text",
                "text": "Regular paragraph text",
                "prov": [{"page_no": 5}]
            },
            {
                "label": "section_header",
                "text": "CNN Architecture",
                "level": 2,
                "prov": [{"page_no": 12}]
            }
        ],
        "tables": [
            {
                "self_ref": "#/tables/0",
                "prov": [{"page_no": 23}],
                "captions": [{"text": "Hyperparameter tuning results"}]
            }
        ],
        "pictures": [
            {
                "self_ref": "#/pictures/0",
                "prov": [{"page_no": 15}],
                "image": {"uri": "images/picture-015.png"}
            }
        ]
    }

    pdf_file = tmp_path / "sample.pdf"
    pdf_file.write_bytes(b"%PDF-1.4\nsample")
    validation = ValidatedDocument(
        file_path=pdf_file,
        file_hash="abc123",
        file_size_bytes=pdf_file.stat().st_size,
        document_key="sample-abc123",
    )

    converted = SimpleNamespace(
        raw_markdown_path=tmp_path / "raw.md",
        raw_json_path=tmp_path / "docling.json",
        docling_metadata_path=tmp_path / "docling_metadata.json",
        markdown="# Deep Learning Foundation\nRegular paragraph text\n## CNN Architecture",
        json_data=mock_docling_json,
        metadata={"page_count": 30, "conversion_status": "SUCCESS"},
        image_paths=["images/picture-015.png"]
    )

    metadata = build_document_metadata(
        validation=validation,
        converted=converted,
        clean_markdown_text=converted.markdown,
        processed_dir=tmp_path,
        dataset_name="docs"
    )

    assert metadata["section_count"] == 2
    assert metadata["sections"][0]["title"] == "Deep Learning Foundation"
    assert metadata["sections"][0]["page_start"] == 5
    assert metadata["sections"][1]["title"] == "CNN Architecture"
    assert metadata["sections"][1]["page_start"] == 12

    assert metadata["tables_count"] == 1
    assert metadata["tables"][0]["page_no"] == 23
    assert metadata["tables"][0]["caption"] == "Hyperparameter tuning results"

    assert metadata["images_count"] == 1
    assert metadata["images"][0]["page_no"] == 15
    assert metadata["images"][0]["uri"] == "images/picture-015.png"
