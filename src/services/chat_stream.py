"""Streaming chat: phát câu trả lời theo token (SSE).

Tái dùng các node của LangGraph cho phần validate → lưu câu hỏi → embed/rewrite
→ truy hồi, chỉ thay bước sinh câu trả lời bằng streaming token. Sự kiện phát ra:

    {"type": "sources", "sources": [...], "conversation_id": "..."}
    {"type": "token", "token": "..."}            # lặp lại nhiều lần
    {"type": "done", "conversation_id": "..."}
    {"type": "error", "message": "..."}

Bất biến quan trọng: luồng LUÔN kết thúc bằng đúng MỘT sự kiện "done" (hoặc khi
chưa stream được token nào thì "error" + "done"). Không bao giờ để client treo ở
trạng thái "AI đang trả lời": mọi lỗi/timeout đều được chuyển thành sự kiện kết
thúc rõ ràng.
"""

import asyncio
import json
from collections.abc import AsyncIterator

from src.agents.nodes.embed_node import embed_query_node
from src.agents.nodes.generate_node import generate_answer_node
from src.agents.nodes.message_node import save_assistant_message_node, save_user_message_node
from src.agents.nodes.retrieve_node import retrieve_context_node
from src.agents.nodes.validate_node import validate_input_node
from src.config import get_settings
from src.services.citations import select_cited_sources
from src.services.llm import _build_messages, get_llm


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _done(state: dict, sources: list | None = None) -> str:
    from src.services.confidence import assess_answer

    cited = sources if sources is not None else []
    assessment = state.get("confidence")
    if not assessment:
        settings = get_settings()
        assessment = assess_answer(
            state.get("response", "") or "",
            cited,
            rag_min_score=settings.rag_min_score,
            rag_fallback_min_score=settings.rag_fallback_min_score,
        )
    return _sse(
        {
            "type": "done",
            "sources": cited,
            "conversation_id": state.get("conversation_id"),
            # message_id câu trả lời AI để client gắn feedback (👍/👎).
            "message_id": state.get("assistant_message_id"),
            # Độ tin cậy tính ở backend (đa tín hiệu, đã hiệu chuẩn) — FE chỉ hiển thị.
            "grounded": assessment["grounded"],
            "confidence": assessment["confidence"],
            "confidence_level": assessment["level"],
            "confidence_factors": assessment["factors"],
        }
    )


async def stream_chat_events(
    *,
    query: str,
    conversation_id: str | None,
    user_id: str | None,
    user_role: str | None = None,
    top_k: int,
    request_id: str | None = None,
) -> AsyncIterator[str]:
    state: dict = {
        "query": query,
        "conversation_id": conversation_id,
        "user_id": user_id,
        "user_role": user_role,
        "top_k": top_k,
        "request_id": request_id,
    }

    # Heartbeat đầu tiên: flush header + "chốt" chế độ streaming với proxy (Render/
    # NGINX) NGAY trước khi làm việc nặng (embed/retrieve mất vài giây). Tránh proxy
    # buffer/timeout trước token đầu tiên. Dòng bắt đầu bằng ":" là comment SSE, FE bỏ qua.
    yield ": keep-alive\n\n"

    try:
        async for event in _run_stream(state):
            yield event
    except asyncio.CancelledError:
        # Client ngắt kết nối: thoát êm, không coi là lỗi.
        raise
    except Exception as exc:  # noqa: BLE001 — chốt chặn cuối, không để treo
        # Bất kỳ lỗi ngoài dự kiến nào (kể cả DB lưu tin nhắn lỗi) cũng phải kết
        # thúc luồng để client thôi hiển thị "AI đang trả lời".
        yield _sse({"type": "error", "message": f"Lỗi hệ thống: {exc}"})
        yield _done(state)


async def _run_stream(state: dict) -> AsyncIterator[str]:
    deadline = get_settings().chat_stream_timeout

    state.update(await validate_input_node(state))
    if state.get("error"):
        yield _sse({"type": "error", "message": state["error"]})
        yield _done(state)
        return

    # Lưu câu hỏi + nạp lịch sử + tạo agent run. Lỗi lưu DB không được làm treo
    # luồng: soft-fail rồi vẫn trả lời (giảm chất lượng lịch sử chứ không chết).
    try:
        state.update(await save_user_message_node(state))
    except Exception:  # noqa: BLE001
        state.setdefault("history", [])

    # Rewrite follow-up + embed; truy hồi + rerank (có timeout ở tầng LLM/embeddings).
    state.update(await embed_query_node(state))
    if not state.get("error"):
        state.update(await retrieve_context_node(state))

    if state.get("error"):
        # Lỗi embed/retrieve: trả câu lỗi qua node generate (đồng bộ) rồi kết thúc.
        try:
            state.update(await generate_answer_node(state))
            await _safe_save_assistant(state)
        except Exception:  # noqa: BLE001
            state["response"] = "Xin lỗi, hệ thống đang bận. Vui lòng thử lại sau giây lát."
        yield _sse({"type": "token", "token": state.get("response", "")})
        yield _done(state)
        return

    # Stream token câu trả lời. Bảo vệ từng lần chờ token bằng wait_for (yield nằm
    # NGOÀI vùng timeout để không vướng lỗi context của async generator) — nếu khoảng
    # lặng giữa 2 token vượt deadline thì kết thúc an toàn thay vì treo vô hạn.
    retrieved = state.get("retrieved_chunks", [])
    messages = _build_messages(
        state["query"], retrieved, state.get("history"), state.get("doc_info")
    )
    full = ""
    errored = False
    fallback_msg = ""
    agen = get_llm().astream(messages).__aiter__()
    while True:
        try:
            chunk = await asyncio.wait_for(agen.__anext__(), timeout=deadline)
        except StopAsyncIteration:
            break
        except TimeoutError:
            errored = True
            fallback_msg = "Xin lỗi, trợ lý phản hồi quá lâu. Vui lòng thử lại."
            break
        except Exception as exc:  # noqa: BLE001
            errored = True
            fallback_msg = f"Lỗi tạo câu trả lời: {exc}"
            break
        token = str(getattr(chunk, "content", "") or "")
        if token:
            full += token
            yield _sse({"type": "token", "token": token})
    if errored and not full and fallback_msg:
        yield _sse({"type": "token", "token": fallback_msg})

    # Chỉ giữ nguồn được trích dẫn trong câu trả lời; lưu + phát ở sự kiện done.
    cited_sources = select_cited_sources(full, state.get("sources", [])) if full else []
    state["response"] = full or state.get("response", "")
    state["sources"] = cited_sources
    # Tính độ tin cậy 1 lần (đa tín hiệu, đã hiệu chuẩn) → lưu kèm message để tải lại
    # hội thoại vẫn hiển thị đúng, và dùng chung cho sự kiện done.
    from src.services.confidence import assess_answer

    _settings = get_settings()
    state["confidence"] = assess_answer(
        state["response"],
        cited_sources,
        rag_min_score=_settings.rag_min_score,
        rag_fallback_min_score=_settings.rag_fallback_min_score,
    )
    if not errored or full:
        await _safe_save_assistant(state)

    # Ghi nhận số token tiêu thụ thực tế
    if state.get("user_id"):
        try:
            from src.db.session import AsyncSessionLocal
            from src.services.billing import record_token_usage
            from src.services.llm import count_messages_tokens, count_text_tokens

            prompt_tokens = count_messages_tokens(messages)
            completion_tokens = count_text_tokens(full)
            total_tokens = prompt_tokens + completion_tokens
            if total_tokens > 0:
                async with AsyncSessionLocal() as session:
                    await record_token_usage(
                        session,
                        user_id=state["user_id"],
                        tokens=total_tokens,
                        request_id=state.get("request_id"),
                    )
        except Exception:
            pass

    yield _done(state, cited_sources)


async def _safe_save_assistant(state: dict) -> None:
    """Lưu câu trả lời của trợ lý; lỗi DB không được làm hỏng luồng trả lời.

    Gộp kết quả về state để lấy `assistant_message_id` (dùng cho feedback ở done).
    """
    try:
        state.update(await save_assistant_message_node(state))
    except Exception:  # noqa: BLE001
        pass
