# pyright: ignore [reportMissingImports]
from langgraph.graph import END, StateGraph

from src.agents.nodes.embed_node import embed_query_node
from src.agents.nodes.generate_node import generate_answer_node
from src.agents.nodes.message_node import save_assistant_message_node, save_user_message_node
from src.agents.nodes.retrieve_node import retrieve_context_node
from src.agents.nodes.validate_node import validate_input_node
from src.agents.state import AgentState


async def route_after_validate(state: AgentState) -> str:
    if state.get("error"):
        return "generate_answer"
    return "save_user_message"


def build_graph():
    graph = StateGraph(AgentState)

    graph.add_node("validate_input", validate_input_node)
    graph.add_node("save_user_message", save_user_message_node)
    graph.add_node("embed_query", embed_query_node)
    graph.add_node("retrieve_context", retrieve_context_node)
    graph.add_node("generate_answer", generate_answer_node)
    graph.add_node("save_assistant_message", save_assistant_message_node)

    graph.set_entry_point("validate_input")
    graph.add_conditional_edges(
        "validate_input",
        route_after_validate,
        {
            "generate_answer": "generate_answer",
            "save_user_message": "save_user_message",
        },
    )
    graph.add_edge("save_user_message", "embed_query")
    graph.add_edge("embed_query", "retrieve_context")
    graph.add_edge("retrieve_context", "generate_answer")
    graph.add_edge("generate_answer", "save_assistant_message")
    graph.add_edge("save_assistant_message", END)

    return graph.compile()


agent = build_graph()
