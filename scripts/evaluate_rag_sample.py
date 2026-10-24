#!/usr/bin/env python3
"""Đánh giá chất lượng, độ trễ và chi phí RAG trên bộ câu hỏi mẫu.

Đo lường:
- citation_match: nguồn truy hồi có đúng tài liệu kỳ vọng không (in-scope).
- out_of_scope_refusal: câu ngoài phạm vi có bị từ chối đúng không.
- faithfulness (LLM-judge): câu trả lời có bám sát CONTEXT, không bịa không.
- answer_relevancy (LLM-judge): câu trả lời có giải quyết đúng câu hỏi không.
- latency: trung bình, p50 và p95 cho toàn bộ request của người dùng.
- estimated_request_cost_usd: chi phí OpenAI ước tính cho embedding query và lần
  sinh câu trả lời. Không tính hai lần gọi LLM-judge vì đó là chi phí benchmark,
  không phải chi phí của người dùng trong production.

Output: eval/results/rag_report.json + rag_report.md
"""
from __future__ import annotations

import argparse
import asyncio
import json
import math
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.agents.graph import agent
from src.services.llm import get_llm

QUESTIONS_FILE = Path("datasets/docs/questions.jsonl")
RESULTS_JSON = Path("eval/results/rag_report.json")
RESULTS_MD = Path("eval/results/rag_report.md")

# Đơn giá USD / 1 triệu token cho cấu hình mặc định gpt-4o-mini +
# text-embedding-3-small. Có thể thay bằng đơn giá hiện hành khi chạy benchmark
# qua các tham số CLI bên dưới; vì vậy báo cáo luôn lưu lại rate đã dùng.
DEFAULT_INPUT_PRICE_PER_MILLION = 0.15
DEFAULT_OUTPUT_PRICE_PER_MILLION = 0.60
DEFAULT_EMBEDDING_PRICE_PER_MILLION = 0.02


def _normalize(value: str | None) -> str:
    if not value:
        return ""
    return value.lower().replace(".pdf", "").replace("-", " ").replace("_", " ").strip()


def _citation_match(expected_document: str | None, sources: list[dict]) -> bool:
    if expected_document is None:
        return not sources
    expected = _normalize(expected_document)
    return any(expected in _normalize(source.get("title", "")) for source in sources)


def _is_refusal(response: str) -> bool:
    response_l = response.lower()
    return "không đủ dữ liệu" in response_l or "không tìm thấy" in response_l


def _sanitize_error(value: object) -> str:
    """Không ghi API key (kể cả dạng key đã được provider che một phần) vào evidence."""
    return re.sub(r"sk-[A-Za-z0-9_*-]+", "sk-***", str(value))


async def _judge_score(prompt: str) -> float:
    """Hỏi LLM trả về điểm 0.0–1.0; parse số đầu tiên, lỗi → 0.0."""
    from langchain_core.messages import HumanMessage, SystemMessage

    messages = [
        SystemMessage(
            content=(
                "Bạn là giám khảo đánh giá chất lượng câu trả lời RAG. "
                "Chỉ trả về MỘT số thực trong khoảng 0.0 đến 1.0, không kèm giải thích."
            )
        ),
        HumanMessage(content=prompt),
    ]
    try:
        response = await get_llm().ainvoke(messages)
        text = str(response.content).strip()
        match = re.search(r"[01](?:\.\d+)?", text)
        return float(match.group(0)) if match else 0.0
    except Exception:
        return 0.0


async def _faithfulness(answer: str, context: str) -> float:
    if not context.strip():
        return 0.0
    return await _judge_score(
        "Đánh giá mức độ TRUNG THỰC: câu trả lời có HOÀN TOÀN được suy ra từ CONTEXT "
        "không (không thêm thông tin ngoài CONTEXT)? 1.0 = hoàn toàn bám sát, "
        "0.0 = bịa đặt hoàn toàn.\n\n"
        f"CONTEXT:\n{context}\n\nCÂU TRẢ LỜI:\n{answer}"
    )


async def _answer_relevancy(question: str, answer: str) -> float:
    return await _judge_score(
        "Đánh giá mức độ LIÊN QUAN: câu trả lời có giải quyết trực tiếp câu hỏi không? "
        "1.0 = trả lời đúng trọng tâm, 0.0 = lạc đề.\n\n"
        f"CÂU HỎI:\n{question}\n\nCÂU TRẢ LỜI:\n{answer}"
    )


def _token_count(text: str, model_name: str = "gpt-4o-mini") -> int:
    """Đếm token để ước tính chi phí embedding khi provider không trả usage."""
    try:
        import tiktoken

        return len(tiktoken.encoding_for_model(model_name).encode(text))
    except Exception:
        # Máy CI/offline có thể chưa cache vocabulary tiktoken. Đây là fallback
        # bảo thủ, giúp benchmark vẫn hoàn tất và chỉ ảnh hưởng phần estimate.
        return math.ceil(len(text) / 4)


def _usage_snapshot(callback: object) -> dict[str, int]:
    return {
        "prompt_tokens": int(getattr(callback, "prompt_tokens", 0)),
        "completion_tokens": int(getattr(callback, "completion_tokens", 0)),
        "total_tokens": int(getattr(callback, "total_tokens", 0)),
    }


def _request_cost_usd(
    usage: dict[str, int],
    embedding_tokens: int,
    *,
    input_price_per_million: float,
    output_price_per_million: float,
    embedding_price_per_million: float,
) -> float:
    return round(
        (
            usage["prompt_tokens"] * input_price_per_million
            + usage["completion_tokens"] * output_price_per_million
            + embedding_tokens * embedding_price_per_million
        )
        / 1_000_000,
        8,
    )


async def _evaluate_one(item: dict, pricing: dict[str, float]) -> dict:
    # Callback của LangChain lấy usage thực tế mà OpenAI trả về cho LLM answer.
    # Embedding không trả về usage qua callback này, nên đếm token query riêng.
    from langchain_community.callbacks.manager import get_openai_callback

    start = time.perf_counter()
    with get_openai_callback() as callback:
        result = await agent.ainvoke(
            {
                "query": item["question"],
                "top_k": 5,
                "metadata": {"skip_persistence": True},
            }
        )
    latency_ms = int((time.perf_counter() - start) * 1000)
    usage = _usage_snapshot(callback)
    embedding_tokens = _token_count(item["question"])
    response = _sanitize_error(result.get("response", ""))
    sources = result.get("sources", [])
    context = "\n\n".join(s.get("quote", "") for s in sources)
    agent_error = _sanitize_error(result["error"]) if result.get("error") else None
    failed = bool(agent_error)

    is_in_scope = item.get("type") != "out-of-scope"
    # Chấm faithfulness/relevancy chỉ cho câu in-scope có câu trả lời thực.
    faithfulness = (
        await _faithfulness(response, context) if not failed and is_in_scope and sources else None
    )
    relevancy = await _answer_relevancy(item["question"], response) if not failed and is_in_scope else None

    return {
        **item,
        "response": response,
        "sources": sources,
        "agent_status": "failed" if failed else "completed",
        "agent_error": agent_error,
        "latency_ms": latency_ms,
        "response_non_empty": bool(response.strip()) and not failed,
        "citation_match": _citation_match(item.get("expected_document"), sources) if not failed else None,
        "out_of_scope_refusal": (is_in_scope or _is_refusal(response)) if not failed else None,
        "faithfulness": faithfulness,
        "answer_relevancy": relevancy,
        "llm_usage": usage,
        "query_embedding_tokens_estimate": embedding_tokens,
        "estimated_request_cost_usd": _request_cost_usd(
            usage,
            embedding_tokens,
            input_price_per_million=pricing["input_price_per_million"],
            output_price_per_million=pricing["output_price_per_million"],
            embedding_price_per_million=pricing["embedding_price_per_million"],
        ) if not failed else None,
    }


def _avg(values: list[float | None]) -> float | None:
    vals = [v for v in values if v is not None]
    return round(sum(vals) / len(vals), 3) if vals else None


def _nearest_rank(values: list[float], percentile: float) -> int:
    """Percentile theo nearest-rank, dễ giải thích cho bộ benchmark nhỏ."""
    if not values:
        return 0
    ordered = sorted(values)
    index = max(0, math.ceil(percentile * len(ordered)) - 1)
    return int(ordered[index])


def _format_metric(value: float | int | None, suffix: str = "") -> str:
    return f"{value}{suffix}" if value is not None else "N/A"


def _format_rate(value: float | None) -> str:
    return f"{value:.1%}" if value is not None else "N/A"


async def main(pricing: dict[str, float]) -> None:
    if not QUESTIONS_FILE.exists():
        raise FileNotFoundError(
            f"Missing evaluation questions file: {QUESTIONS_FILE}. "
            "Create it as JSONL, or update QUESTIONS_FILE to the dataset you want to evaluate."
        )

    questions = [
        json.loads(line)
        for line in QUESTIONS_FILE.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    results = [await _evaluate_one(item, pricing) for item in questions]
    completed = [r for r in results if r.get("agent_status") == "completed"]
    failed = [r for r in results if r.get("agent_status") == "failed"]
    in_scope = [r for r in completed if r.get("type") != "out-of-scope"]
    out_of_scope = [r for r in completed if r.get("type") == "out-of-scope"]
    latencies = [r["latency_ms"] for r in results]
    completed_latencies = [r["latency_ms"] for r in completed]
    costs = [r["estimated_request_cost_usd"] for r in completed]
    citation_values = [float(r["citation_match"]) for r in in_scope]
    refusal_values = [float(r["out_of_scope_refusal"]) for r in out_of_scope]
    summary = {
        "total": len(results),
        "completed_runs": len(completed),
        "failed_runs": len(failed),
        "failure_rate": _avg([float(r.get("agent_status") == "failed") for r in results]),
        "in_scope": len(in_scope),
        "out_of_scope": len(out_of_scope),
        "response_non_empty": sum(r["response_non_empty"] for r in completed),
        "response_non_empty_rate": _avg([float(r["response_non_empty"]) for r in completed]),
        "citation_matches": sum(r["citation_match"] for r in in_scope),
        "citation_match_rate": _avg(citation_values),
        "out_of_scope_refusals": sum(r["out_of_scope_refusal"] for r in out_of_scope),
        "out_of_scope_refusal_rate": _avg(refusal_values),
        "avg_faithfulness": _avg([r["faithfulness"] for r in results]),
        "avg_answer_relevancy": _avg([r["answer_relevancy"] for r in results]),
        "avg_attempt_latency_ms": int(sum(latencies) / max(len(latencies), 1)),
        "p50_attempt_latency_ms": _nearest_rank(latencies, 0.50),
        "p95_attempt_latency_ms": _nearest_rank(latencies, 0.95),
        "avg_latency_ms": int(sum(completed_latencies) / len(completed_latencies)) if completed else None,
        "p50_latency_ms": _nearest_rank(completed_latencies, 0.50) if completed else None,
        "p95_latency_ms": _nearest_rank(completed_latencies, 0.95) if completed else None,
        "avg_estimated_request_cost_usd": round(sum(costs) / len(costs), 8) if costs else None,
        "p95_estimated_request_cost_usd": round(max(costs), 8) if costs else None,
        "total_estimated_request_cost_usd": round(sum(costs), 8) if costs else None,
        "pricing_usd_per_million_tokens": pricing,
    }
    RESULTS_JSON.parent.mkdir(parents=True, exist_ok=True)
    RESULTS_JSON.write_text(
        json.dumps({"summary": summary, "results": results}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    lines = [
        "# RAG Evaluation Report",
        "",
        f"- Total questions: {summary['total']} (completed: {summary['completed_runs']}, failed: {summary['failed_runs']})",
        f"- Failure rate: {_format_rate(summary['failure_rate'])}",
        f"- Non-empty responses: {summary['response_non_empty']}/{summary['completed_runs']} ({_format_rate(summary['response_non_empty_rate'])})",
        f"- In-scope citation matches: {summary['citation_matches']}/{summary['in_scope']} ({_format_rate(summary['citation_match_rate'])})",
        f"- Out-of-scope refusals: {summary['out_of_scope_refusals']}/{summary['out_of_scope']} ({_format_rate(summary['out_of_scope_refusal_rate'])})",
        f"- Avg faithfulness (LLM-judge): {_format_metric(summary['avg_faithfulness'])}",
        f"- Avg answer relevancy (LLM-judge): {_format_metric(summary['avg_answer_relevancy'])}",
        f"- Successful-request latency (avg / p50 / p95): {_format_metric(summary['avg_latency_ms'])} / {_format_metric(summary['p50_latency_ms'])} / {_format_metric(summary['p95_latency_ms'])} ms",
        f"- Attempt latency (avg / p50 / p95): {summary['avg_attempt_latency_ms']} / {summary['p50_attempt_latency_ms']} / {summary['p95_attempt_latency_ms']} ms",
        f"- Estimated user-request cost (avg / p95): ${_format_metric(summary['avg_estimated_request_cost_usd'])} / ${_format_metric(summary['p95_estimated_request_cost_usd'])}",
        "- Cost excludes LLM-judge calls; pricing used is saved in rag_report.json.",
        "",
        "## Results",
    ]
    for r in results:
        lines.append(
            f"- `{r['type']}` status={r['agent_status']} citation={r['citation_match']} "
            f"faithful={r['faithfulness']} relevancy={r['answer_relevancy']} "
            f"latency={r['latency_ms']}ms cost=${_format_metric(r['estimated_request_cost_usd'])} — {r['question']}"
        )
    RESULTS_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate RAG quality, latency, and cost.")
    parser.add_argument(
        "--input-price-per-million",
        type=float,
        default=DEFAULT_INPUT_PRICE_PER_MILLION,
        help="USD / 1M input tokens of the configured LLM.",
    )
    parser.add_argument(
        "--output-price-per-million",
        type=float,
        default=DEFAULT_OUTPUT_PRICE_PER_MILLION,
        help="USD / 1M output tokens of the configured LLM.",
    )
    parser.add_argument(
        "--embedding-price-per-million",
        type=float,
        default=DEFAULT_EMBEDDING_PRICE_PER_MILLION,
        help="USD / 1M embedding input tokens.",
    )
    args = parser.parse_args()
    asyncio.run(
        main(
            {
                "input_price_per_million": args.input_price_per_million,
                "output_price_per_million": args.output_price_per_million,
                "embedding_price_per_million": args.embedding_price_per_million,
            }
        )
    )
