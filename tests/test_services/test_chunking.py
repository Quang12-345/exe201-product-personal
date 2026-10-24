from src.services.chunking import chunk_pages
from src.services.document_parser import ParsedPage


def test_chunk_pages_keeps_page_number():
    pages = [ParsedPage(page_number=3, text="hello world " * 200)]
    chunks = chunk_pages(pages, model_name="text-embedding-3-small", chunk_size=50, chunk_overlap=10)
    assert chunks
    assert all(chunk.page_number == 3 for chunk in chunks)
    assert all(chunk.content.strip() for chunk in chunks)
    assert all(chunk.token_count > 0 for chunk in chunks)
