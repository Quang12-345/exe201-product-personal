from __future__ import annotations

import calendar
import hashlib
import hmac
import logging
import time
from datetime import UTC, date, datetime, timedelta, timezone
from secrets import token_hex
from urllib.parse import parse_qs, urlencode, urlsplit

import httpx
from fastapi import HTTPException, Request
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.db.models import ChatUsageEvent, DailyChatUsage, PaymentTransaction, Subscription

FREE_DAILY_TOKEN_LIMIT = 200_000
PRO_DAILY_TOKEN_LIMIT = 900_000
FREE_DAILY_LIMIT = FREE_DAILY_TOKEN_LIMIT  # Backward-compatible alias
PRO_PRICE_VND = 99_000
VN_TZ = timezone(timedelta(hours=7), name="UTC+07:00")
logger = logging.getLogger(__name__)

QUERYDR_REQUEST_FIELDS = (
    "vnp_RequestId",
    "vnp_Version",
    "vnp_Command",
    "vnp_TmnCode",
    "vnp_TxnRef",
    "vnp_TransactionDate",
    "vnp_CreateDate",
    "vnp_IpAddr",
    "vnp_OrderInfo",
)
QUERYDR_RESPONSE_FIELDS = (
    "vnp_ResponseId",
    "vnp_Command",
    "vnp_ResponseCode",
    "vnp_Message",
    "vnp_TmnCode",
    "vnp_TxnRef",
    "vnp_Amount",
    "vnp_BankCode",
    "vnp_PayDate",
    "vnp_TransactionNo",
    "vnp_TransactionType",
    "vnp_TransactionStatus",
    "vnp_OrderInfo",
    "vnp_PromotionCode",
    "vnp_PromotionAmount",
)


def _utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _now_vn() -> datetime:
    return datetime.now(VN_TZ)


def _as_utc_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.replace(tzinfo=UTC).isoformat().replace("+00:00", "Z")


def _reset_at(today: date) -> str:
    reset = datetime.combine(today + timedelta(days=1), datetime.min.time(), tzinfo=VN_TZ)
    return reset.isoformat()


async def _active_subscription(session: AsyncSession, user_id: str) -> Subscription | None:
    result = await session.execute(
        select(Subscription).where(
            Subscription.user_id == user_id,
            Subscription.status == "active",
            Subscription.expires_at > _utc_now(),
        )
    )
    return result.scalar_one_or_none()


async def get_billing_status(
    session: AsyncSession, *, user_id: str, user_role: str | None
) -> dict:
    settings = get_settings()
    free_limit = getattr(settings, "free_daily_token_limit", FREE_DAILY_TOKEN_LIMIT)
    pro_limit = getattr(settings, "pro_daily_token_limit", PRO_DAILY_TOKEN_LIMIT)

    if user_role != "student":
        return {
            "plan": "staff",
            "is_pro": True,
            "price_vnd": PRO_PRICE_VND,
            "daily_limit": None,
            "daily_token_limit": None,
            "used_today": 0,
            "tokens_used_today": 0,
            "remaining_today": None,
            "remaining_tokens_today": None,
            "query_count_today": 0,
            "reset_at": None,
            "expires_at": None,
        }

    subscription = await _active_subscription(session, user_id)
    today = _now_vn().date()

    # Tự động đối soát đơn hàng chưa hoàn tất trong 48h (ví dụ PayOS vừa chuyển khoản xong)
    if subscription is None:
        recent_pending_res = await session.execute(
            select(PaymentTransaction)
            .where(
                PaymentTransaction.user_id == user_id,
                PaymentTransaction.status == "pending",
                PaymentTransaction.created_at >= _utc_now() - timedelta(days=2),
            )
            .order_by(PaymentTransaction.created_at.desc())
            .limit(1)
        )
        recent_tx = recent_pending_res.scalar_one_or_none()
        if recent_tx and recent_tx.provider == "payos":
            try:
                rec_status = await query_payos_and_reconcile(session, order_code=recent_tx.order_code)
                if rec_status == "paid":
                    subscription = await _active_subscription(session, user_id)
            except Exception as exc:
                logger.warning("Auto-reconcile PayOS failed during get_billing_status: %s", exc)

    pending_result = await session.execute(
        select(PaymentTransaction.order_code)
        .where(
            PaymentTransaction.user_id == user_id,
            PaymentTransaction.status == "pending",
        )
        .order_by(PaymentTransaction.created_at.desc())
        .limit(1)
    )
    pending_order_code = pending_result.scalar_one_or_none()

    result = await session.execute(
        select(DailyChatUsage.tokens_used, DailyChatUsage.count).where(
            DailyChatUsage.user_id == user_id,
            DailyChatUsage.usage_date == today,
        )
    )
    row = result.first()
    tokens_used = (row[0] or 0) if row else 0
    query_count = (row[1] or 0) if row else 0

    if subscription is not None:
        limit = pro_limit
        return {
            "plan": "pro",
            "is_pro": True,
            "price_vnd": PRO_PRICE_VND,
            "daily_limit": limit,
            "daily_token_limit": limit,
            "used_today": tokens_used,
            "tokens_used_today": tokens_used,
            "remaining_today": max(0, limit - tokens_used),
            "remaining_tokens_today": max(0, limit - tokens_used),
            "query_count_today": query_count,
            "reset_at": _reset_at(today),
            "expires_at": _as_utc_iso(subscription.expires_at),
            "pending_order_code": pending_order_code,
        }

    limit = free_limit
    return {
        "plan": "free",
        "is_pro": False,
        "price_vnd": PRO_PRICE_VND,
        "daily_limit": limit,
        "daily_token_limit": limit,
        "used_today": tokens_used,
        "tokens_used_today": tokens_used,
        "remaining_today": max(0, limit - tokens_used),
        "remaining_tokens_today": max(0, limit - tokens_used),
        "query_count_today": query_count,
        "reset_at": _reset_at(today),
        "expires_at": None,
        "pending_order_code": pending_order_code,
    }


async def reserve_chat_use(
    session: AsyncSession,
    *,
    user_id: str,
    user_role: str | None,
    request_id: str,
    estimated_tokens: int = 0,
) -> None:
    if user_role != "student":
        return
    if not request_id or len(request_id) > 64:
        raise HTTPException(status_code=400, detail="Mã yêu cầu chat không hợp lệ.")

    today = _now_vn().date()
    now = _utc_now()
    dialect_name = session.get_bind().dialect.name
    insert = pg_insert if dialect_name == "postgresql" else sqlite_insert

    event_stmt = insert(ChatUsageEvent).values(
        id=token_hex(18),
        user_id=user_id,
        usage_date=today,
        request_id=request_id,
        tokens=estimated_tokens,
        created_at=now,
    ).on_conflict_do_nothing(index_elements=["user_id", "usage_date", "request_id"])
    event_result = await session.execute(event_stmt)
    if event_result.rowcount == 0:
        await session.rollback()
        return

    await session.execute(
        delete(ChatUsageEvent).where(
            ChatUsageEvent.usage_date < today - timedelta(days=7)
        )
    )

    settings = get_settings()
    subscription = await _active_subscription(session, user_id)
    is_pro = subscription is not None
    limit = (
        getattr(settings, "pro_daily_token_limit", PRO_DAILY_TOKEN_LIMIT)
        if is_pro
        else getattr(settings, "free_daily_token_limit", FREE_DAILY_TOKEN_LIMIT)
    )

    usage_check = await session.execute(
        select(DailyChatUsage.tokens_used).where(
            DailyChatUsage.user_id == user_id,
            DailyChatUsage.usage_date == today,
        )
    )
    current_tokens = usage_check.scalar_one_or_none() or 0
    if current_tokens >= limit:
        await session.rollback()
        formatted_limit = f"{limit:,}".replace(",", ".")
        plan_name = "Pro" if is_pro else "miễn phí"
        raise HTTPException(
            status_code=429,
            detail={
                "code": "daily_token_limit_reached",
                "message": f"Bạn đã dùng hết {formatted_limit} tokens của gói {plan_name} hôm nay.",
                "used_today": current_tokens,
                "daily_limit": limit,
                "tokens_used_today": current_tokens,
                "daily_token_limit": limit,
                "reset_at": _reset_at(today),
                "pro_price_vnd": PRO_PRICE_VND,
            },
        )

    usage_stmt = insert(DailyChatUsage).values(
        id=token_hex(18),
        user_id=user_id,
        usage_date=today,
        count=1,
        tokens_used=estimated_tokens,
        created_at=now,
        updated_at=now,
    ).on_conflict_do_update(
        index_elements=["user_id", "usage_date"],
        set_={
            "count": DailyChatUsage.count + 1,
            "tokens_used": DailyChatUsage.tokens_used + estimated_tokens,
            "updated_at": now,
        },
    ).returning(DailyChatUsage.tokens_used)
    await session.execute(usage_stmt)
    await session.commit()


async def record_token_usage(
    session: AsyncSession,
    *,
    user_id: str,
    tokens: int,
    request_id: str | None = None,
) -> None:
    if not user_id or tokens <= 0:
        return

    today = _now_vn().date()
    now = _utc_now()
    dialect_name = session.get_bind().dialect.name
    insert = pg_insert if dialect_name == "postgresql" else sqlite_insert

    usage_stmt = insert(DailyChatUsage).values(
        id=token_hex(18),
        user_id=user_id,
        usage_date=today,
        count=1,
        tokens_used=tokens,
        created_at=now,
        updated_at=now,
    ).on_conflict_do_update(
        index_elements=["user_id", "usage_date"],
        set_={
            "tokens_used": DailyChatUsage.tokens_used + tokens,
            "updated_at": now,
        },
    )
    await session.execute(usage_stmt)

    if request_id:
        from sqlalchemy import update

        await session.execute(
            update(ChatUsageEvent)
            .where(
                ChatUsageEvent.user_id == user_id,
                ChatUsageEvent.usage_date == today,
                ChatUsageEvent.request_id == request_id,
            )
            .values(tokens=tokens)
        )
    await session.commit()


def _signature(params: dict[str, str], secret: str) -> str:
    cleaned = {
        key: str(value).strip()
        for key, value in params.items()
        if value is not None and str(value).strip() != ""
    }
    signed = urlencode(sorted(cleaned.items()))
    return hmac.new(secret.strip().encode("utf-8"), signed.encode("utf-8"), hashlib.sha512).hexdigest()


def verify_vnpay_signature(params: dict[str, str], secret: str) -> bool:
    supplied = params.get("vnp_SecureHash", "")
    secret_clean = (secret or "").strip()
    if not supplied or not secret_clean:
        return False
    signed_params = {
        key: str(value).strip()
        for key, value in params.items()
        if key.startswith("vnp_")
        and key not in {"vnp_SecureHash", "vnp_SecureHashType"}
        and value is not None
        and str(value).strip() != ""
    }
    expected = _signature(signed_params, secret_clean)
    return hmac.compare_digest(expected.lower(), supplied.strip().lower())


def _querydr_signature(fields: tuple[str, ...], values: dict[str, str], secret: str) -> str:
    signed_data = "|".join(str(values.get(field, "") or "") for field in fields)
    return hmac.new(secret.encode(), signed_data.encode(), hashlib.sha512).hexdigest()


def _querydr_request(payment: PaymentTransaction, *, ip_address: str, settings) -> dict[str, str]:
    checkout_params = parse_qs(urlsplit(payment.checkout_url or "").query)
    create_date = (checkout_params.get("vnp_CreateDate") or [None])[0]
    if not create_date:
        created_at = datetime.fromtimestamp(payment.order_code / 1_000_000, tz=UTC)
        create_date = created_at.astimezone(VN_TZ).strftime("%Y%m%d%H%M%S")
    order_info = (checkout_params.get("vnp_OrderInfo") or [f"Pro monthly {payment.order_code}"])[0]
    payload = {
        "vnp_RequestId": token_hex(16),
        "vnp_Version": "2.1.0",
        "vnp_Command": "querydr",
        "vnp_TmnCode": settings.vnpay_tmn_code,
        "vnp_TxnRef": str(payment.order_code),
        "vnp_TransactionDate": create_date,
        "vnp_CreateDate": _now_vn().strftime("%Y%m%d%H%M%S"),
        "vnp_IpAddr": (ip_address or "127.0.0.1")[:45],
        "vnp_OrderInfo": order_info,
    }
    payload["vnp_SecureHash"] = _querydr_signature(
        QUERYDR_REQUEST_FIELDS, payload, settings.vnpay_hash_secret
    )
    return payload


def _verify_querydr_response(response: dict, secret: str) -> bool:
    supplied = str(response.get("vnp_SecureHash", ""))
    expected = _querydr_signature(QUERYDR_RESPONSE_FIELDS, response, secret)
    return bool(supplied) and hmac.compare_digest(expected, supplied.lower())


async def _send_querydr(settings, payload: dict[str, str]) -> dict:
    verify_ssl = "sandbox.vnpayment.vn" not in (settings.vnpay_query_url or "")
    async with httpx.AsyncClient(timeout=15.0, verify=verify_ssl) as client:
        response = await client.post(settings.vnpay_query_url, json=payload)
        response.raise_for_status()
        return response.json()


async def create_vnpay_checkout(
    session: AsyncSession,
    *,
    user,
    ip_address: str,
    return_to: str | None = None,
) -> dict[str, str | int]:
    settings = get_settings()
    tmn_code = (settings.vnpay_tmn_code or "").strip()
    hash_secret = (settings.vnpay_hash_secret or "").strip()
    if not tmn_code or not hash_secret:
        raise HTTPException(status_code=503, detail="Thanh toán VNPay chưa được cấu hình.")

    order_code = time.time_ns() // 1_000
    now = _now_vn()
    expires = now + timedelta(minutes=15)
    transaction = PaymentTransaction(
        user_id=user.id,
        order_code=order_code,
        amount=PRO_PRICE_VND,
        provider="vnpay",
        status="pending",
        raw_webhook={"return_to": return_to} if return_to else None,
    )
    session.add(transaction)
    await session.flush()

    # Chuẩn hóa IP sang IPv4 hợp lệ
    clean_ip = ip_address.strip() if ip_address else "127.0.0.1"
    if ":" in clean_ip or not clean_ip:
        clean_ip = "127.0.0.1"

    return_url = (settings.vnpay_return_url or "http://localhost:8000/api/v1/payments/vnpay/return").strip()
    payment_url = (settings.vnpay_payment_url or "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html").strip()

    params = {
        "vnp_Version": "2.1.0",
        "vnp_Command": "pay",
        "vnp_TmnCode": tmn_code,
        "vnp_Amount": str(PRO_PRICE_VND * 100),
        "vnp_CurrCode": "VND",
        "vnp_TxnRef": str(order_code),
        "vnp_OrderInfo": f"Pro monthly {order_code}",
        "vnp_OrderType": "other",
        "vnp_Locale": "vn",
        "vnp_ReturnUrl": return_url,
        "vnp_IpAddr": clean_ip[:45],
        "vnp_CreateDate": now.strftime("%Y%m%d%H%M%S"),
        "vnp_ExpireDate": expires.strftime("%Y%m%d%H%M%S"),
    }
    params["vnp_SecureHash"] = _signature(params, hash_secret)
    checkout_url = f"{payment_url}?{urlencode(sorted(params.items()))}"
    transaction.checkout_url = checkout_url
    await session.commit()
    return {
        "checkout_url": checkout_url,
        "payment_url": checkout_url,
        "order_code": order_code,
        "amount": PRO_PRICE_VND,
    }


def _add_calendar_month(value: datetime) -> datetime:
    month_index = value.month
    year = value.year + (month_index == 12)
    month = 1 if month_index == 12 else month_index + 1
    return value.replace(year=year, month=month, day=min(value.day, calendar.monthrange(year, month)[1]))


async def _complete_payment(
    session: AsyncSession,
    payment: PaymentTransaction,
    *,
    transaction_ref: str | None,
    verification_data: dict,
) -> None:
    if payment.status == "paid":
        return
    now = _utc_now()
    payment.status = "paid"
    payment.transaction_ref = transaction_ref
    payment.raw_webhook = verification_data
    payment.paid_at = now
    result = await session.execute(
        select(Subscription).where(Subscription.user_id == payment.user_id)
    )
    subscription = result.scalar_one_or_none()
    if subscription is None:
        session.add(
            Subscription(
                user_id=payment.user_id,
                plan_code="pro",
                status="active",
                starts_at=now,
                expires_at=_add_calendar_month(now),
            )
        )
    else:
        active_expiry = subscription.expires_at if (
            subscription.status == "active" and subscription.expires_at and subscription.expires_at > now
        ) else now
        subscription.status = "active"
        subscription.starts_at = subscription.starts_at or now
        subscription.expires_at = _add_calendar_month(active_expiry)
    await session.commit()


async def query_vnpay_and_reconcile(
    session: AsyncSession,
    *,
    order_code: int,
    ip_address: str,
) -> str:
    settings = get_settings()
    if not settings.vnpay_tmn_code or not settings.vnpay_hash_secret:
        return "pending"

    result = await session.execute(
        select(PaymentTransaction).where(PaymentTransaction.order_code == order_code)
    )
    payment = result.scalar_one_or_none()
    if payment is None:
        await session.rollback()
        return "not_found"
    if payment.status == "paid":
        await session.rollback()
        return "paid"

    payload = _querydr_request(
        payment,
        ip_address=settings.vnpay_server_ip or ip_address,
        settings=settings,
    )
    payment_id = payment.id
    await session.rollback()
    try:
        response = await _send_querydr(settings, payload)
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("VNPay QueryDR request failed: %s", type(exc).__name__)
        return "pending"

    if not isinstance(response, dict):
        logger.warning("VNPay QueryDR returned an invalid response body")
        return "pending"
    if not _verify_querydr_response(response, settings.vnpay_hash_secret):
        logger.warning("VNPay QueryDR response signature is invalid")
        return "pending"
    try:
        response_amount = int(response.get("vnp_Amount", "-1"))
    except (TypeError, ValueError):
        return "pending"
    if (
        str(response.get("vnp_ResponseCode")) != "00"
        or str(response.get("vnp_TmnCode")) != settings.vnpay_tmn_code
        or str(response.get("vnp_TxnRef")) != str(order_code)
        or str(response.get("vnp_TransactionStatus")) != "00"
        or str(response.get("vnp_TransactionType")) != "01"
    ):
        return "pending"

    result = await session.execute(
        select(PaymentTransaction).where(PaymentTransaction.id == payment_id).with_for_update()
    )
    payment = result.scalar_one_or_none()
    if payment is None:
        await session.rollback()
        return "not_found"
    if response_amount != payment.amount * 100:
        await session.rollback()
        logger.warning("VNPay QueryDR amount does not match order %s", order_code)
        return "pending"
    if payment.status != "paid":
        await _complete_payment(
            session,
            payment,
            transaction_ref=str(response.get("vnp_TransactionNo") or "") or None,
            verification_data={"source": "querydr", **response},
        )
    else:
        await session.rollback()
    return "paid"


async def process_vnpay_ipn(session: AsyncSession, params: dict[str, str]) -> dict[str, str]:
    settings = get_settings()
    tmn_code = (settings.vnpay_tmn_code or "").strip()
    hash_secret = (settings.vnpay_hash_secret or "").strip()
    if not hash_secret or not verify_vnpay_signature(params, hash_secret):
        return {"RspCode": "97", "Message": "Invalid signature"}
    if params.get("vnp_TmnCode", "").strip() != tmn_code:
        return {"RspCode": "97", "Message": "Invalid merchant"}

    try:
        order_code = int(params["vnp_TxnRef"])
    except (KeyError, ValueError):
        return {"RspCode": "01", "Message": "Order not found"}

    result = await session.execute(
        select(PaymentTransaction)
        .where(PaymentTransaction.order_code == order_code)
        .with_for_update()
    )
    payment = result.scalar_one_or_none()
    if payment is None:
        return {"RspCode": "01", "Message": "Order not found"}
    try:
        paid_amount = int(params.get("vnp_Amount", "-1"))
    except ValueError:
        return {"RspCode": "04", "Message": "Invalid amount"}
    if paid_amount != payment.amount * 100:
        return {"RspCode": "04", "Message": "Invalid amount"}
    if payment.status == "paid":
        return {"RspCode": "02", "Message": "Order already confirmed"}

    successful = (
        params.get("vnp_ResponseCode") == "00"
        and params.get("vnp_TransactionStatus") == "00"
    )
    if successful:
        await _complete_payment(
            session,
            payment,
            transaction_ref=params.get("vnp_TransactionNo"),
            verification_data=params,
        )
    else:
        payment.raw_webhook = params
        payment.transaction_ref = params.get("vnp_TransactionNo")
        payment.status = "failed"
        await session.commit()
    return {"RspCode": "00", "Message": "Confirm Success"}


def vnpay_params_from_request(request: Request) -> dict[str, str]:
    return {key: value for key, value in request.query_params.multi_items() if key.startswith("vnp_")}


# ==============================================================================
# PAYOS GATEWAY INTEGRATION (VIETQR CHUYỂN KHOẢN TRỰC TIẾP TÀI KHOẢN CÁ NHÂN)
# ==============================================================================

def _payos_sort_obj_by_key(obj: dict) -> dict:
    """Sắp xếp dict theo key bảng chữ cái."""
    return {k: obj[k] for k in sorted(obj.keys())}


def _payos_convert_obj_to_query_str(data: dict) -> str:
    """Chuyển object data sang query string chuẩn HMAC-SHA256 theo tài liệu PayOS.
    
    Lưu ý: PayOS yêu cầu:
    - Sắp xếp key theo bảng chữ cái.
    - Không bỏ sót key có value là null (chuyển thành chuỗi rỗng: 'key=').
    - Boolean chuyển thành 'true'/'false'.
    - Array/list chuyển thành JSON string với các dict con cũng được sort.
    """
    import json
    sorted_obj = _payos_sort_obj_by_key(data)
    parts = []
    for k, v in sorted_obj.items():
        if v is None:
            v_str = ""
        elif isinstance(v, bool):
            v_str = "true" if v else "false"
        elif isinstance(v, list):
            sorted_items = [_payos_sort_obj_by_key(x) if isinstance(x, dict) else x for x in v]
            v_str = json.dumps(sorted_items, separators=(",", ":"), ensure_ascii=False)
        else:
            v_str = str(v)
        parts.append(f"{k}={v_str}")
    return "&".join(parts)


def _payos_signature(data: dict, checksum_key: str) -> str:
    """Tạo chữ ký HMAC-SHA256 cho PayOS."""
    query_str = _payos_convert_obj_to_query_str(data)
    return hmac.new(
        checksum_key.strip().encode("utf-8"),
        query_str.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_payos_webhook_signature(data_dict: dict, signature: str, checksum_key: str) -> bool:
    """Xác thực chữ ký HMAC-SHA256 webhook gửi từ PayOS."""
    if not signature or not checksum_key or not isinstance(data_dict, dict):
        return False
    query_str = _payos_convert_obj_to_query_str(data_dict)
    expected = hmac.new(
        checksum_key.strip().encode("utf-8"),
        query_str.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected.lower(), signature.strip().lower())


async def create_payos_checkout(
    session: AsyncSession,
    *,
    user,
    return_to: str | None = None,
    client_origin: str | None = None,
) -> dict[str, str | int]:
    """Tạo link thanh toán VietQR động qua PayOS chuyển thẳng vào STK cá nhân."""
    settings = get_settings()
    client_id = (settings.payos_client_id or "").strip()
    api_key = (settings.payos_api_key or "").strip()
    checksum_key = (settings.payos_checksum_key or "").strip()

    if not client_id or not api_key or not checksum_key:
        raise HTTPException(
            status_code=503,
            detail="Cổng thanh toán PayOS chưa được cấu hình. Vui lòng kiểm tra PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY trong file .env."
        )

    # Mã đơn hàng số nguyên an toàn trong JavaScript (dưới 9007199254740991)
    order_code = int(time.time() * 1000) % 9_000_000_000_000_000

    # Ưu tiên client_origin từ browser người dùng nếu không phải localhost (hoặc fallback sang settings)
    frontend_base = (
        client_origin
        if (client_origin and not any(h in client_origin for h in ["localhost", "127.0.0.1"]))
        else (settings.frontend_url or client_origin or "http://localhost:5173")
    ).strip().rstrip("/")

    return_path = return_to if (return_to and return_to.startswith("/student/")) else "/student/chat"
    
    # Hướng dẫn PayOS chuyển hướng về trang biên nhận & kích hoạt Pro
    return_url = f"{frontend_base}/student/payment/success?order_code={order_code}&return_to={return_path}"
    cancel_url = f"{frontend_base}/student/payment/cancel?order_code={order_code}&return_to={return_path}"

    # PayOS description tối đa 25 ký tự không dấu/kèm mã đơn
    description = f"Pro {order_code}"[-25:]

    # PayOS yêu cầu sắp xếp đúng: amount, cancelUrl, description, orderCode, returnUrl
    data_to_sign = {
        "amount": PRO_PRICE_VND,
        "cancelUrl": cancel_url,
        "description": description,
        "orderCode": order_code,
        "returnUrl": return_url,
    }
    signature = _payos_signature(data_to_sign, checksum_key)

    payload = {
        "orderCode": order_code,
        "amount": PRO_PRICE_VND,
        "description": description,
        "cancelUrl": cancel_url,
        "returnUrl": return_url,
        "signature": signature,
    }

    headers = {
        "x-client-id": client_id,
        "x-api-key": api_key,
        "Content-Type": "application/json",
    }

    endpoint = (settings.payos_endpoint or "https://api-merchant.payos.vn").rstrip("/") + "/v2/payment-requests"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(endpoint, json=payload, headers=headers)
            resp_data = resp.json()
    except Exception as exc:
        logger.error("PayOS API connection error: %s", exc)
        raise HTTPException(status_code=502, detail=f"Không thể kết nối đến cổng thanh toán PayOS: {exc}")

    if resp.status_code != 200 or resp_data.get("code") != "00":
        err_msg = resp_data.get("desc") or resp_data.get("message") or f"HTTP {resp.status_code}"
        logger.error("PayOS create link failed: %s", resp_data)
        raise HTTPException(status_code=400, detail=f"PayOS lỗi: {err_msg}")

    data = resp_data.get("data") or {}
    checkout_url = data.get("checkoutUrl")
    payment_link_id = data.get("paymentLinkId")

    transaction = PaymentTransaction(
        user_id=user.id,
        order_code=order_code,
        amount=PRO_PRICE_VND,
        currency="VND",
        provider="payos",
        status="pending",
        payment_link_id=payment_link_id,
        checkout_url=checkout_url,
        raw_webhook={"return_to": return_to, "payos_data": data} if return_to else {"payos_data": data},
    )
    session.add(transaction)
    await session.commit()

    return {
        "checkout_url": checkout_url,
        "payment_url": checkout_url,
        "order_code": order_code,
        "amount": PRO_PRICE_VND,
        "qr_code": data.get("qrCode"),
    }


async def query_payos_and_reconcile(
    session: AsyncSession,
    *,
    order_code: int,
) -> str:
    """Truy vấn trực tiếp đơn hàng từ PayOS API để đối soát và kích hoạt Pro ngay cả khi không có Webhook."""
    settings = get_settings()
    client_id = (settings.payos_client_id or "").strip()
    api_key = (settings.payos_api_key or "").strip()
    if not client_id or not api_key:
        return "pending"

    result = await session.execute(
        select(PaymentTransaction).where(PaymentTransaction.order_code == order_code)
    )
    payment = result.scalar_one_or_none()
    if payment is None:
        return "not_found"
    if payment.status == "paid":
        return "paid"

    endpoint = (settings.payos_endpoint or "https://api-merchant.payos.vn").rstrip("/") + f"/v2/payment-requests/{order_code}"
    headers = {
        "x-client-id": client_id,
        "x-api-key": api_key,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(endpoint, headers=headers)
            resp_data = resp.json()
    except Exception as exc:
        logger.warning("PayOS querydr failed: %s", exc)
        return "pending"

    if resp.status_code != 200 or resp_data.get("code") != "00":
        return "pending"

    data = resp_data.get("data") or {}
    status = str(data.get("status") or "").upper()
    amount_paid = int(data.get("amountPaid") or 0)

    if status == "PAID" or amount_paid >= payment.amount:
        if payment.status != "paid":
            transactions = data.get("transactions") or []
            tx0 = transactions[0] if (isinstance(transactions, list) and len(transactions) > 0) else {}
            tx_ref = str(tx0.get("reference") or data.get("id") or "")
            await _complete_payment(
                session,
                payment,
                transaction_ref=tx_ref,
                verification_data={"source": "payos_query", **data},
            )
        return "paid"

    return "pending"


async def process_payos_webhook(session: AsyncSession, payload: dict) -> dict:
    """Xử lý webhook tự động từ PayOS khi khách quét mã chuyển tiền thành công."""
    settings = get_settings()
    checksum_key = (settings.payos_checksum_key or "").strip()

    data = payload.get("data")
    signature = payload.get("signature")

    # Xác nhận webhook URL khi bấm "Kiểm tra Webhook" trên trang PayOS
    if not data or not signature:
        return {"code": "00", "desc": "success"}

    if checksum_key and not verify_payos_webhook_signature(data, signature, checksum_key):
        logger.warning("PayOS webhook signature mismatch")
        raise HTTPException(status_code=400, detail="Invalid signature")

    order_code = data.get("orderCode")
    if not order_code:
        return {"code": "00", "desc": "success"}

    result = await session.execute(
        select(PaymentTransaction).where(PaymentTransaction.order_code == int(order_code))
    )
    payment = result.scalar_one_or_none()
    if payment is None:
        return {"code": "00", "desc": "Order not found"}

    if payment.status == "paid":
        return {"code": "00", "desc": "Order already processed"}

    # Mã code thành công của PayOS
    if str(payload.get("code")) == "00" or str(data.get("code")) == "00":
        transactions = data.get("transactions") or []
        tx0 = transactions[0] if (isinstance(transactions, list) and len(transactions) > 0) else {}
        tx_ref = str(tx0.get("reference") or data.get("reference") or data.get("paymentLinkId") or "")
        await _complete_payment(
            session,
            payment,
            transaction_ref=tx_ref,
            verification_data=payload,
        )

    return {"code": "00", "desc": "success"}


async def get_payment_receipt(
    session: AsyncSession,
    *,
    order_code: int,
) -> dict:
    """Lấy thông tin chi tiết biên nhận thanh toán (Receipt) để hiển thị cho người dùng."""
    stmt = select(PaymentTransaction).where(PaymentTransaction.order_code == order_code)
    result = await session.execute(stmt)
    payment = result.scalar_one_or_none()
    if payment is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn thanh toán.")

    # Nếu vẫn đang pending và là PayOS, thực hiện đối soát tự động ngay
    if payment.status == "pending" and payment.provider == "payos":
        await query_payos_and_reconcile(session, order_code=order_code)
        await session.refresh(payment)

    raw = payment.raw_webhook or {}
    payos_data = raw.get("payos_data") or (raw if raw.get("transactions") else {})
    transactions = payos_data.get("transactions") or []
    tx0 = transactions[0] if (isinstance(transactions, list) and len(transactions) > 0) else {}

    # Thời gian giao dịch ngân hàng
    tx_time_str = (
        tx0.get("transactionDateTime")
        or (payment.paid_at.strftime("%H:%M:%S - %d/%m/%Y") if payment.paid_at else None)
        or payment.created_at.strftime("%H:%M:%S - %d/%m/%Y")
    )
    account_number = tx0.get("accountNumber") or payos_data.get("accountNumber") or "Tài khoản PayOS"
    ref_code = payment.transaction_ref or tx0.get("reference") or payos_data.get("reference") or str(payment.order_code)

    return {
        "order_code": payment.order_code,
        "amount": payment.amount,
        "currency": payment.currency,
        "provider": payment.provider,
        "status": payment.status,
        "is_paid": payment.status == "paid",
        "recipient_name": "STUDYMIND - Nền Tảng Học Tập AI",
        "plan_name": "Gói Pro Sinh Viên (30 ngày)",
        "transaction_time": tx_time_str,
        "transaction_ref": ref_code,
        "account_number": account_number,
        "created_at": payment.created_at.isoformat() if payment.created_at else None,
        "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
    }
