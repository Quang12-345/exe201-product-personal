from dataclasses import dataclass
from typing import TYPE_CHECKING

import tiktoken

if TYPE_CHECKING:
    from src.services.document_parser import ParsedPage


@dataclass(frozen=True)
class TextChunk:
    chunk_index: int
    content: str
    page_number: int
    token_count: int
    metadata: dict


class _SimpleEncoding:
    def encode(self, text: str) -> list[str]:
        return text.split()

    def decode(self, tokens: list[str]) -> str:
        return " ".join(tokens)


def _encoding(model_name: str):
    try:
        return tiktoken.encoding_for_model(model_name)
    except Exception:
        try:
            return tiktoken.get_encoding("cl100k_base")
        except Exception:
            return _SimpleEncoding()


def chunk_pages(
    pages: list["ParsedPage"],
    *,
    model_name: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 150,
) -> list[TextChunk]:
    if chunk_overlap >= chunk_size:
        raise ValueError("chunk_overlap must be smaller than chunk_size")

    encoding = _encoding(model_name)
    chunks: list[TextChunk] = []
    chunk_index = 0

    for page in pages:
        tokens = encoding.encode(page.text)
        if not tokens:
            continue

        step = chunk_size - chunk_overlap
        for start in range(0, len(tokens), step):
            token_slice = tokens[start : start + chunk_size]
            content = encoding.decode(token_slice).strip()
            if not content:
                continue
            chunks.append(
                TextChunk(
                    chunk_index=chunk_index,
                    content=content,
                    page_number=page.page_number,
                    token_count=len(token_slice),
                    metadata={
                        "page_number": page.page_number,
                        "token_start": start,
                        "token_end": start + len(token_slice),
                    },
                )
            )
            chunk_index += 1
            if start + chunk_size >= len(tokens):
                break

    return chunks
