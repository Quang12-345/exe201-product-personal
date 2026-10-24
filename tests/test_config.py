from pathlib import Path

from src.config import get_settings


def test_settings_load_env_values():
    get_settings.cache_clear()
    settings = get_settings()
    assert settings.qdrant_collection_name == "project-db"
    assert settings.embedding_dimension == 1536


def test_config_does_not_hardcode_secrets():
    text = Path("src/config.py").read_text(encoding="utf-8")
    assert "validation_alias=\"OPENAI_API_KEY\"" in text
    assert "validation_alias=\"QDRANT_API_KEY\"" in text
    assert "eyJ" not in text
    assert "69d45bab" not in text
