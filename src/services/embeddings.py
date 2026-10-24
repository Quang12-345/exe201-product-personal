from src.config import get_settings


def get_embedding_model():
    from langchain_openai import OpenAIEmbeddings

    settings = get_settings()
    if settings.embedding_provider != "openai":
        raise ValueError(f"Unsupported embedding provider: {settings.embedding_provider}")
    return OpenAIEmbeddings(
        model=settings.embedding_model,
        api_key=settings.openai_api_key,
        # Timeout + retry để truy hồi không treo khi OpenAI chậm/lỗi mạng.
        timeout=settings.llm_request_timeout,
        max_retries=settings.llm_max_retries,
    )


async def embed_query(query: str) -> list[float]:
    embeddings = get_embedding_model()
    return await embeddings.aembed_query(query)


async def embed_documents(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    embeddings = get_embedding_model()
    return await embeddings.aembed_documents(texts)
