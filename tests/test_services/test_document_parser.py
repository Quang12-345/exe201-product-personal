from pathlib import Path

from src.services.document_parser import parse_pdf_pages


def test_parse_pdf_pages_keeps_page_numbers():
    pdf_path = Path("datasets/docs/google_prompt.pdf")
    pages = parse_pdf_pages(pdf_path)
    assert pages
    assert pages[0].page_number >= 1
    assert pages[0].text.strip()
