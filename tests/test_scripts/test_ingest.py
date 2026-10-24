from scripts import ingest


def test_database_preflight_ignores_sqlite():
    assert ingest.database_preflight_error("sqlite:///./data/app.db") is None


def test_database_preflight_reports_unreachable_postgres(monkeypatch):
    def fake_create_connection(address, timeout):
        assert address == ("localhost", 5432)
        assert timeout == 0.1
        raise ConnectionRefusedError("connection refused")

    monkeypatch.setattr(ingest.socket, "create_connection", fake_create_connection)

    message = ingest.database_preflight_error(
        "postgresql://hva:secret@localhost:5432/ragai",
        timeout=0.1,
    )

    assert message is not None
    assert "Cannot connect to Postgres at localhost:5432" in message
    assert "database=ragai, user=hva" in message
    assert "secret" not in message
