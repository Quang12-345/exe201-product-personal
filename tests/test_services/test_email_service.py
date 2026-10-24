from types import SimpleNamespace

import pytest

from src.services import email_service
from src.services.email_templates import get_email_verification_template, get_password_reset_template


def test_password_reset_template_contains_professional_content():
    html = get_password_reset_template("123456")

    assert "Yêu cầu đặt lại mật khẩu" in html
    assert "Mã xác thực" in html
    assert "123456" in html
    assert "&copy; 2026 DMRS. Bảo lưu mọi quyền." in html
    assert "font-family:Arial, Helvetica, sans-serif" in html


def test_email_verification_template_contains_otp():
    html = get_email_verification_template("654321")

    assert "Xác nhận địa chỉ Gmail" in html
    assert "Mã xác thực" in html
    assert "654321" in html
    assert "&copy; 2026 DMRS. Bảo lưu mọi quyền." in html


@pytest.mark.asyncio
async def test_send_otp_email_uses_html_alternative(monkeypatch):
    sent = {}

    async def fake_send(message, **kwargs):
        sent["message"] = message
        sent["kwargs"] = kwargs

    monkeypatch.setattr(
        email_service,
        "get_settings",
        lambda: SimpleNamespace(
            brevo_api_key="",
            email_host="smtp.gmail.com",
            email_port=587,
            email_username="dmrs.support@gmail.com",
            email_password="secret",
            email_from="dmrs.support@gmail.com",
            email_from_name="DMRS",
            email_timeout=15.0,
            app_env="production",
        ),
    )
    monkeypatch.setattr(email_service.aiosmtplib, "send", fake_send)

    await email_service.send_otp_email("user@example.com", "123456")

    message = sent["message"]
    assert message["Subject"] == "DMRS - Mã xác thực đặt lại mật khẩu"
    assert message["From"] == "dmrs.support@gmail.com"
    assert message["To"] == "user@example.com"
    assert message.is_multipart()
    assert message.get_body(preferencelist=("html",)).get_content_subtype() == "html"
    assert "123456" in message.get_body(preferencelist=("html",)).get_content()
    assert sent["kwargs"]["hostname"] == "smtp.gmail.com"
    assert sent["kwargs"]["start_tls"] is True
    assert sent["kwargs"]["use_tls"] is False
    assert sent["kwargs"]["timeout"] == 15.0


@pytest.mark.asyncio
async def test_send_otp_email_uses_brevo_when_key_present(monkeypatch):
    captured = {}

    class FakeResponse:
        status_code = 201
        text = ""

    class FakeClient:
        def __init__(self, *args, **kwargs):
            captured["client_kwargs"] = kwargs

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, url, json, headers):
            captured["url"] = url
            captured["json"] = json
            captured["headers"] = headers
            return FakeResponse()

    monkeypatch.setattr(
        email_service,
        "get_settings",
        lambda: SimpleNamespace(
            brevo_api_key="brevo-key",
            email_username="dmrs.support@gmail.com",
            email_from="dmrs.support@gmail.com",
            email_from_name="DMRS",
            email_timeout=15.0,
            app_env="production",
        ),
    )
    monkeypatch.setattr(email_service.httpx, "AsyncClient", FakeClient)

    await email_service.send_otp_email("user@example.com", "123456")

    assert captured["url"] == email_service.BREVO_API_URL
    assert captured["headers"]["api-key"] == "brevo-key"
    assert captured["json"]["sender"]["email"] == "dmrs.support@gmail.com"
    assert "123456" in captured["json"]["htmlContent"]


def test_is_smtp_configured_detects_dummy_and_empty_passwords():
    settings_dummy = SimpleNamespace(email_username="user@gmail.com", email_password="your-gmail-app-password")
    assert email_service.is_smtp_configured(settings_dummy) is False

    settings_empty = SimpleNamespace(email_username="user@gmail.com", email_password="")
    assert email_service.is_smtp_configured(settings_empty) is False

    settings_valid = SimpleNamespace(email_username="user@gmail.com", email_password="real-app-password")
    assert email_service.is_smtp_configured(settings_valid) is True


@pytest.mark.asyncio
async def test_send_account_created_email_does_not_raise_in_dev_mode(monkeypatch):
    monkeypatch.setattr(
        email_service,
        "get_settings",
        lambda: SimpleNamespace(
            brevo_api_key="",
            email_host="smtp.gmail.com",
            email_port=587,
            email_username="dmrs.support@gmail.com",
            email_password="your-gmail-app-password",
            email_from="dmrs.support@gmail.com",
            email_from_name="DMRS",
            email_timeout=15.0,
            app_env="development",
        ),
    )

    # Should not raise exception because it's dev mode with dummy password
    await email_service.send_account_created_email("newuser@example.com", "newuser", "InitialPass123!")

