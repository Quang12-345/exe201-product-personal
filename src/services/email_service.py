import logging
from email.message import EmailMessage
from secrets import randbelow

import aiosmtplib
import httpx
from aiosmtplib.errors import (
    SMTPAuthenticationError,
    SMTPRecipientsRefused,
    SMTPTimeoutError,
)

from src.config import get_settings
from src.services.email_templates import (
    get_account_created_template,
    get_email_verification_template,
    get_password_reset_template,
)

logger = logging.getLogger(__name__)
PASSWORD_RESET_SUBJECT = "DMRS - Mã xác thực đặt lại mật khẩu"
EMAIL_VERIFY_SUBJECT = "DMRS - Mã OTP xác nhận tài khoản"
ACCOUNT_CREATED_SUBJECT = "DMRS - Thông tin tài khoản của bạn"
BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"
SMTP_MAX_ATTEMPTS = 2


class EmailError(Exception):
    """Lỗi gửi email chung — controller map sang HTTP status tương ứng."""


class EmailConfigError(EmailError):
    """Cấu hình/xác thực email sai (credentials, sender chưa verify) → 500."""


class EmailRecipientError(EmailError):
    """Địa chỉ người nhận không hợp lệ / bị từ chối → 400."""


class EmailDeliveryError(EmailError):
    """Không kết nối/gửi được (timeout, cổng bị chặn, lỗi tạm thời) → 503."""


def generate_otp() -> str:
    otp = f"{randbelow(1_000_000):06d}"
    logger.info("Password reset OTP generated")
    return otp


def _build_message(email: str, otp: str) -> tuple[str, str, str]:
    """Trả về (text, html, subject) cho email OTP."""
    text_content = f"""Xin chào,

Mã OTP của bạn là: {otp}

Mã OTP này sẽ hết hạn sau 5 phút.

Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.

Trân trọng,
Đội ngũ hỗ trợ DMRS
"""
    return text_content, get_password_reset_template(otp), PASSWORD_RESET_SUBJECT


def _build_verification_message(otp: str) -> tuple[str, str, str]:
    text_content = f"""Xin chào,

Mã OTP xác nhận tài khoản của bạn là: {otp}

Mã OTP này sẽ hết hạn sau 5 phút.

Nếu bạn không đăng ký tài khoản DMRS, vui lòng bỏ qua email này.

Trân trọng,
Đội ngũ hỗ trợ DMRS
"""
    return text_content, get_email_verification_template(otp), EMAIL_VERIFY_SUBJECT


def _build_account_message(username: str, password: str) -> tuple[str, str, str]:
    text_content = f"""Xin chào,

Tài khoản DMRS của bạn đã được tạo.

Tài khoản: {username}
Mật khẩu: {password}

Tài khoản đang ở trạng thái chờ kích hoạt. Sau khi đăng nhập, bạn sẽ được yêu cầu cập nhật mật khẩu để kích hoạt tài khoản.

Trân trọng,
Đội ngũ hỗ trợ DMRS
"""
    return text_content, get_account_created_template(username, password), ACCOUNT_CREATED_SUBJECT


DUMMY_EMAIL_PASSWORDS = {
    "your-gmail-app-password",
    "changeme",
    "password",
    "your-password",
    "your-email-password",
}


def is_smtp_configured(settings) -> bool:
    if not settings.email_username or not settings.email_password:
        return False
    if settings.email_password.strip().lower() in DUMMY_EMAIL_PASSWORDS:
        return False
    return True


async def send_otp_email(email: str, otp: str) -> None:
    settings = get_settings()

    # Ưu tiên Brevo HTTP API (cổng 443, không bị Render chặn như SMTP).
    if settings.brevo_api_key:
        try:
            await _send_via_brevo(email, otp)
            return
        except EmailError:
            if settings.app_env != "production":
                logger.warning("DEV MODE: gửi email OTP qua Brevo thất bại — OTP cho %s là %s", email, otp)
                return
            raise

    if not is_smtp_configured(settings):
        # Dev/demo: chưa cấu hình SMTP thì không chặn luồng — ghi OTP ra log để thử.
        # Production vẫn yêu cầu cấu hình email (báo lỗi rõ ràng).
        if settings.app_env != "production":
            logger.warning(
                "DEV MODE: chưa cấu hình email hoặc dùng mật khẩu mẫu — OTP cho %s là %s (xem log, không gửi email)",
                email,
                otp,
            )
            return
        logger.error("Email sending failed: email provider is not configured")
        raise EmailConfigError("Email provider is not configured")

    try:
        await _send_via_smtp(email, otp)
    except EmailError as exc:
        if settings.app_env != "production":
            logger.warning(
                "DEV MODE: Gửi OTP qua SMTP thất bại (%s) — OTP cho %s là %s",
                exc,
                email,
                otp,
            )
            return
        raise


async def send_verification_otp_email(email: str, otp: str) -> None:
    settings = get_settings()
    text_content, html_content, subject = _build_verification_message(otp)

    if settings.brevo_api_key:
        try:
            await _send_message_via_brevo(email, text_content, html_content, subject, "Email verification OTP")
            return
        except EmailError:
            if settings.app_env != "production":
                logger.warning("DEV MODE: gửi verification OTP qua Brevo thất bại — OTP cho %s là %s", email, otp)
                return
            raise

    if not is_smtp_configured(settings):
        if settings.app_env != "production":
            logger.warning(
                "DEV MODE: chưa cấu hình email hoặc dùng mật khẩu mẫu — OTP xác nhận tài khoản cho %s là %s (xem log, không gửi email)",
                email,
                otp,
            )
            return
        logger.error("Email sending failed: email provider is not configured")
        raise EmailConfigError("Email provider is not configured")

    try:
        await _send_message_via_smtp(email, text_content, html_content, subject, "Email verification OTP")
    except EmailError as exc:
        if settings.app_env != "production":
            logger.warning(
                "DEV MODE: Gửi verification OTP qua SMTP thất bại (%s) — OTP cho %s là %s",
                exc,
                email,
                otp,
            )
            return
        raise


async def send_account_created_email(email: str, username: str, password: str) -> None:
    settings = get_settings()
    text_content, html_content, subject = _build_account_message(username, password)

    if settings.brevo_api_key:
        try:
            await _send_message_via_brevo(email, text_content, html_content, subject, "Account created")
            return
        except EmailError:
            if settings.app_env != "production":
                logger.warning(
                    "DEV MODE: gửi email tài khoản qua Brevo thất bại — tài khoản mới cho %s: %s",
                    email,
                    text_content,
                )
                return
            raise

    if not is_smtp_configured(settings):
        if settings.app_env != "production":
            logger.warning(
                "DEV MODE: chưa cấu hình email hoặc dùng mật khẩu mẫu — tài khoản mới cho %s: %s",
                email,
                text_content,
            )
            return
        logger.error("Email sending failed: email provider is not configured")
        raise EmailConfigError("Email provider is not configured")

    try:
        await _send_message_via_smtp(email, text_content, html_content, subject, "Account created")
    except EmailError as exc:
        if settings.app_env != "production":
            logger.warning(
                "DEV MODE: Gửi email tài khoản qua SMTP thất bại (%s) — tài khoản mới cho %s: %s",
                exc,
                email,
                text_content,
            )
            return
        raise


async def _send_message_via_brevo(
    email: str,
    text_content: str,
    html_content: str,
    subject: str,
    log_context: str,
) -> None:
    settings = get_settings()
    sender_email = settings.email_from or settings.email_username
    if not sender_email:
        logger.error("Email sending failed: EMAIL_FROM/EMAIL_USERNAME chưa cấu hình cho Brevo")
        raise EmailConfigError("Sender email is not configured for Brevo")

    payload = {
        "sender": {"email": sender_email, "name": settings.email_from_name},
        "to": [{"email": email}],
        "subject": subject,
        "textContent": text_content,
        "htmlContent": html_content,
    }
    headers = {
        "api-key": settings.brevo_api_key,
        "accept": "application/json",
        "content-type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=settings.email_timeout) as client:
            response = await client.post(BREVO_API_URL, json=payload, headers=headers)
    except httpx.TimeoutException as exc:
        logger.exception("Email sending failed: Brevo request timed out")
        raise EmailDeliveryError("Email service timed out") from exc
    except httpx.HTTPError as exc:
        logger.exception("Email sending failed: Brevo connection error")
        raise EmailDeliveryError("Could not reach email service") from exc

    if response.status_code in (200, 201):
        logger.info("%s email sent successfully via Brevo", log_context)
        return

    body = response.text
    if response.status_code in (400, 401, 403):
        logger.error("Email sending failed: Brevo rejected request (%s): %s", response.status_code, body)
        raise EmailConfigError(f"Brevo rejected request: {response.status_code}")
    logger.error("Email sending failed: Brevo error (%s): %s", response.status_code, body)
    raise EmailDeliveryError(f"Brevo error: {response.status_code}")


async def _send_message_via_smtp(
    email: str,
    text_content: str,
    html_content: str,
    subject: str,
    log_context: str,
) -> None:
    settings = get_settings()
    message = EmailMessage()
    message["From"] = settings.email_from or settings.email_username
    message["To"] = email
    message["Subject"] = subject
    message.set_content(text_content)
    message.add_alternative(html_content, subtype="html")

    use_ssl = settings.email_port == 465

    last_exc: Exception | None = None
    for attempt in range(1, SMTP_MAX_ATTEMPTS + 1):
        try:
            await aiosmtplib.send(
                message,
                hostname=settings.email_host,
                port=settings.email_port,
                username=settings.email_username,
                password=settings.email_password,
                use_tls=use_ssl,
                start_tls=not use_ssl,
                timeout=settings.email_timeout,
            )
            logger.info("%s email sent successfully via SMTP", log_context)
            return
        except SMTPAuthenticationError as exc:
            logger.exception("Email sending failed: SMTP authentication failed")
            raise EmailConfigError("SMTP authentication failed") from exc
        except SMTPRecipientsRefused as exc:
            logger.exception("Email sending failed: recipient address was refused")
            raise EmailRecipientError("Recipient address was refused") from exc
        except SMTPTimeoutError as exc:
            last_exc = exc
            logger.warning("SMTP timeout (lần %s/%s)", attempt, SMTP_MAX_ATTEMPTS)
        except aiosmtplib.SMTPException as exc:
            last_exc = exc
            logger.warning("SMTP lỗi (lần %s/%s): %s", attempt, SMTP_MAX_ATTEMPTS, exc)

    logger.error("Email sending failed: SMTP không gửi được sau %s lần thử", SMTP_MAX_ATTEMPTS)
    raise EmailDeliveryError("Could not send account email via SMTP") from last_exc


async def _send_via_brevo(email: str, otp: str) -> None:
    settings = get_settings()
    text_content, html_content, subject = _build_message(email, otp)
    sender_email = settings.email_from or settings.email_username
    if not sender_email:
        logger.error("Email sending failed: EMAIL_FROM/EMAIL_USERNAME chưa cấu hình cho Brevo")
        raise EmailConfigError("Sender email is not configured for Brevo")

    payload = {
        "sender": {"email": sender_email, "name": settings.email_from_name},
        "to": [{"email": email}],
        "subject": subject,
        "textContent": text_content,
        "htmlContent": html_content,
    }
    headers = {
        "api-key": settings.brevo_api_key,
        "accept": "application/json",
        "content-type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=settings.email_timeout) as client:
            response = await client.post(BREVO_API_URL, json=payload, headers=headers)
    except httpx.TimeoutException as exc:
        logger.exception("Email sending failed: Brevo request timed out")
        raise EmailDeliveryError("Email service timed out") from exc
    except httpx.HTTPError as exc:
        logger.exception("Email sending failed: Brevo connection error")
        raise EmailDeliveryError("Could not reach email service") from exc

    if response.status_code in (200, 201):
        logger.info("Password reset OTP email sent successfully via Brevo")
        return

    body = response.text
    if response.status_code in (400, 401, 403):
        # Sai API key / sender chưa verify → lỗi cấu hình, retry không cứu được.
        logger.error("Email sending failed: Brevo rejected request (%s): %s", response.status_code, body)
        raise EmailConfigError(f"Brevo rejected request: {response.status_code}")
    logger.error("Email sending failed: Brevo error (%s): %s", response.status_code, body)
    raise EmailDeliveryError(f"Brevo error: {response.status_code}")


async def _send_via_smtp(email: str, otp: str) -> None:
    settings = get_settings()
    text_content, html_content, subject = _build_message(email, otp)

    message = EmailMessage()
    message["From"] = settings.email_from or settings.email_username
    message["To"] = email
    message["Subject"] = subject
    message.set_content(text_content)
    message.add_alternative(html_content, subtype="html")

    # Port 465 = SSL ngầm (use_tls); các port khác (587) = STARTTLS.
    use_ssl = settings.email_port == 465

    last_exc: Exception | None = None
    for attempt in range(1, SMTP_MAX_ATTEMPTS + 1):
        try:
            await aiosmtplib.send(
                message,
                hostname=settings.email_host,
                port=settings.email_port,
                username=settings.email_username,
                password=settings.email_password,
                use_tls=use_ssl,
                start_tls=not use_ssl,
                timeout=settings.email_timeout,
            )
            logger.info("Password reset OTP email sent successfully via SMTP")
            return
        except SMTPAuthenticationError as exc:
            logger.exception("Email sending failed: SMTP authentication failed")
            raise EmailConfigError("SMTP authentication failed") from exc
        except SMTPRecipientsRefused as exc:
            logger.exception("Email sending failed: recipient address was refused")
            raise EmailRecipientError("Recipient address was refused") from exc
        except SMTPTimeoutError as exc:
            last_exc = exc
            logger.warning(
                "SMTP timeout (lần %s/%s) tới %s:%s — có thể cổng SMTP bị chặn",
                attempt,
                SMTP_MAX_ATTEMPTS,
                settings.email_host,
                settings.email_port,
            )
        except aiosmtplib.SMTPException as exc:
            last_exc = exc
            logger.warning(
                "SMTP lỗi (lần %s/%s): %s", attempt, SMTP_MAX_ATTEMPTS, exc
            )

    logger.error("Email sending failed: SMTP không gửi được sau %s lần thử", SMTP_MAX_ATTEMPTS)
    raise EmailDeliveryError("Could not send OTP email via SMTP") from last_exc
