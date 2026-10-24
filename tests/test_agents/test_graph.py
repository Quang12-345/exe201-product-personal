import pytest

from src.agents import graph as graph_module


@pytest.mark.asyncio
async def test_agent_basic_flow(monkeypatch):
    async def fake_save_user(state):
        return {}

    async def fake_embed(state):
        return {"query_embedding": [0.1] * 1536}

    async def fake_retrieve(state):
        return {
            "retrieved_chunks": [{"content": "Relevant context"}],
            "context": "Relevant context",
            "sources": [
                {
                    "document_id": "doc-1",
                    "title": "Lecture",
                    "page_number": 1,
                    "chunk_id": "chunk-1",
                    "score": 0.9,
                }
            ],
        }

    async def fake_generate(state):
        return {"response": "Answer with source [1]."}

    async def fake_save_assistant(state):
        return {}

    monkeypatch.setattr(graph_module, "save_user_message_node", fake_save_user)
    monkeypatch.setattr(graph_module, "embed_query_node", fake_embed)
    monkeypatch.setattr(graph_module, "retrieve_context_node", fake_retrieve)
    monkeypatch.setattr(graph_module, "generate_answer_node", fake_generate)
    monkeypatch.setattr(graph_module, "save_assistant_message_node", fake_save_assistant)
    agent = graph_module.build_graph()
    result = await agent.ainvoke({"query": "Hello"})
    assert "response" in result
    assert result["sources"][0]["chunk_id"] == "chunk-1"


@pytest.mark.asyncio
async def test_agent_state_structure():
    agent = graph_module.build_graph()
    result = await agent.ainvoke({"query": "", "metadata": {"skip_persistence": True}})
    assert isinstance(result, dict)
    assert "error" in result
