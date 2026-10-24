from dataclasses import dataclass
from pathlib import Path

from pypdf import PdfReader


@dataclass(frozen=True)
class ParsedPage:
    page_number: int
    text: str


def parse_pdf_pages(file_path: Path) -> list[ParsedPage]:
    reader = PdfReader(str(file_path))
    pages: list[ParsedPage] = []
    for index, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        if text.strip():
            pages.append(ParsedPage(page_number=index, text=text.strip()))
    return pages
