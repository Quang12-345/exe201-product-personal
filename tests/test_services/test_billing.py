from datetime import datetime, timedelta
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from src.db.models import Base, PaymentTransaction, Subscription
from src.services import billing


@pytest_asyncio.fixture
async def billing_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_free_student_has_two_hundred_thousand_daily_token_limit_and_retries_are_idempotent(billing_session):
    # Free student can reserve and retries with same request_id are idempotent
    await billing.reserve_chat_use(
        billing_session,
        user_id="student-1",
        user_role="student",
        request_id="request-0",
    )
    await billing.reserve_chat_use(
        billing_session,
        user_id="student-1",
        user_role="student",
        request_id="request-0",
    )

    # Record token usage up to 200,000 tokens
    await billing.record_token_usage(
        billing_session,
        user_id="student-1",
        tokens=200_000,
        request_id="request-0",
    )

    # Next attempt should be rejected with 429
    with pytest.raises(HTTPException) as error:
        await billing.reserve_chat_use(
            billing_session,
            user_id="student-1",
            user_role="student",
            request_id="request-over-limit",
        )

    assert error.value.status_code == 429
    assert error.value.detail["daily_limit"] == 200_000
    assert error.value.detail["daily_token_limit"] == 200_000
    status = await billing.get_billing_status(
        billing_session, user_id="student-1", user_role="student"
    )
    assert status["used_today"] == 200_000
    assert status["tokens_used_today"] == 200_000
    assert status["remaining_today"] == 0
    assert status["daily_limit"] == 200_000


@pytest.mark.asyncio
async def test_pro_student_has_nine_hundred_thousand_daily_token_limit(billing_session):
    billing_session.add(
        Subscription(
            user_id="student-pro",
            plan_code="pro",
            status="active",
            starts_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=30),
        )
    )
    await billing_session.commit()

    # Can use within 900,000 token limit
    await billing.reserve_chat_use(
        billing_session,
        user_id="student-pro",
        user_role="student",
        request_id="pro-1",
    )
    await billing.record_token_usage(
        billing_session,
        user_id="student-pro",
        tokens=500_000,
        request_id="pro-1",
    )

    status = await billing.get_billing_status(
        billing_session, user_id="student-pro", user_role="student"
    )
    assert status["is_pro"] is True
    assert status["daily_token_limit"] == 900_000
    assert status["daily_limit"] == 900_000
    assert status["used_today"] == 500_000
    assert status["remaining_today"] == 400_000

    # Exceeding 900,000 tokens
    await billing.record_token_usage(
        billing_session,
        user_id="student-pro",
        tokens=400_000,
    )
    with pytest.raises(HTTPException) as error:
        await billing.reserve_chat_use(
            billing_session,
            user_id="student-pro",
            user_role="student",
            request_id="pro-over-limit",
        )
    assert error.value.status_code == 429
    assert error.value.detail["daily_limit"] == 900_000


@pytest.mark.asyncio
async def test_vnpay_checkout_creates_signed_99000_vnd_order(billing_session, monkeypatch):
    monkeypatch.setattr(
        billing,
        "get_settings",
        lambda: SimpleNamespace(
            vnpay_tmn_code="TST12345",
            vnpay_hash_secret="test-secret",
            vnpay_payment_url="https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
            vnpay_return_url="https://merchant.example/api/v1/billing/vnpay/return",
        ),
    )
    result = await billing.create_vnpay_checkout(
        billing_session,
        user=SimpleNamespace(id="student-checkout", full_name="Student"),
        ip_address="127.0.0.1",
    )
    params = {key: value[0] for key, value in parse_qs(urlparse(result["checkout_url"]).query).items()}

    assert result["amount"] == 99_000
    assert params["vnp_Amount"] == "9900000"
    assert params["vnp_TmnCode"] == "TST12345"
    assert billing.verify_vnpay_signature(params, "test-secret")


def test_vnpay_signature_rejects_tampered_amount():
    params = {"vnp_TxnRef": "123", "vnp_Amount": "9900000", "vnp_ResponseCode": "00"}
    params["vnp_SecureHash"] = billing._signature(params, "test-secret")

    assert billing.verify_vnpay_signature(params, "test-secret")
    assert not billing.verify_vnpay_signature(
        {**params, "vnp_Amount": "1"}, "test-secret"
    )


@pytest.mark.asyncio
async def test_valid_vnpay_ipn_activates_one_month_once(billing_session, monkeypatch):
    monkeypatch.setattr(
        billing,
        "get_settings",
        lambda: SimpleNamespace(vnpay_hash_secret="test-secret", vnpay_tmn_code="TST12345"),
    )
    payment = PaymentTransaction(
        user_id="student-paid",
        order_code=123456,
        amount=99_000,
        provider="vnpay",
        status="pending",
    )
    billing_session.add(payment)
    await billing_session.commit()

    params = {
        "vnp_TmnCode": "TST12345",
        "vnp_TxnRef": "123456",
        "vnp_Amount": "9900000",
        "vnp_ResponseCode": "00",
        "vnp_TransactionStatus": "00",
        "vnp_TransactionNo": "987654321",
    }
    params["vnp_SecureHash"] = billing._signature(params, "test-secret")

    assert await billing.process_vnpay_ipn(billing_session, params) == {
        "RspCode": "00",
        "Message": "Confirm Success",
    }
    result = await billing_session.execute(
        select(Subscription).where(Subscription.user_id == "student-paid")
    )
    subscription = result.scalar_one()
    expiry = subscription.expires_at
    assert subscription.status == "active"
    assert await billing.process_vnpay_ipn(billing_session, params) == {
        "RspCode": "02",
        "Message": "Order already confirmed",
    }
    assert subscription.expires_at == expiry


def _signed_querydr_response(*, amount="9900000", secret="query-secret"):
    response = {
        "vnp_ResponseId": "response-1",
        "vnp_Command": "querydr",
        "vnp_ResponseCode": "00",
        "vnp_Message": "Success",
        "vnp_TmnCode": "TST12345",
        "vnp_TxnRef": "234567",
        "vnp_Amount": amount,
        "vnp_BankCode": "NCB",
        "vnp_PayDate": "20260926221244",
        "vnp_TransactionNo": "15688363",
        "vnp_TransactionType": "01",
        "vnp_TransactionStatus": "00",
        "vnp_OrderInfo": "Pro monthly 234567",
        "vnp_PromotionCode": "",
        "vnp_PromotionAmount": "",
    }
    response["vnp_SecureHash"] = billing._querydr_signature(
        billing.QUERYDR_RESPONSE_FIELDS, response, secret
    )
    return response


async def _create_querydr_pending_order(session):
    payment = PaymentTransaction(
        user_id="student-querydr",
        order_code=234567,
        amount=99_000,
        provider="vnpay",
        status="pending",
        checkout_url=(
            "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?"
            "vnp_CreateDate=20260926120000&vnp_OrderInfo=Pro+monthly+234567"
        ),
    )
    session.add(payment)
    await session.commit()
    return payment


@pytest.mark.asyncio
async def test_querydr_uses_original_payment_date_and_activates_pro_once(billing_session, monkeypatch):
    settings = SimpleNamespace(
        vnpay_tmn_code="TST12345",
        vnpay_hash_secret="query-secret",
        vnpay_query_url="https://sandbox.example/querydr",
        vnpay_server_ip="203.0.113.10",
    )
    monkeypatch.setattr(billing, "get_settings", lambda: settings)
    payment = await _create_querydr_pending_order(billing_session)
    captured = {}

    async def send_query(settings_arg, payload):
        captured.update(payload)
        return _signed_querydr_response()

    monkeypatch.setattr(billing, "_send_querydr", send_query)

    result = await billing.query_vnpay_and_reconcile(
        billing_session,
        order_code=payment.order_code,
        ip_address="127.0.0.1",
    )

    assert result == "paid"
    assert captured["vnp_TransactionDate"] == "20260926120000"
    assert captured["vnp_IpAddr"] == "203.0.113.10"
    assert captured["vnp_SecureHash"] == billing._querydr_signature(
        billing.QUERYDR_REQUEST_FIELDS, captured, "query-secret"
    )
    await billing_session.refresh(payment)
    assert payment.status == "paid"
    subscription = (
        await billing_session.execute(
            select(Subscription).where(Subscription.user_id == "student-querydr")
        )
    ).scalar_one()
    assert subscription.status == "active"

    expiry = subscription.expires_at
    assert await billing.query_vnpay_and_reconcile(
        billing_session,
        order_code=payment.order_code,
        ip_address="127.0.0.1",
    ) == "paid"
    await billing_session.refresh(subscription)
    assert subscription.expires_at == expiry


@pytest.mark.asyncio
@pytest.mark.parametrize("response_kwargs", [{"amount": "990000"}, {"secret": "wrong-secret"}])
async def test_querydr_rejects_wrong_amount_or_signature(billing_session, monkeypatch, response_kwargs):
    monkeypatch.setattr(
        billing,
        "get_settings",
        lambda: SimpleNamespace(
            vnpay_tmn_code="TST12345",
            vnpay_hash_secret="query-secret",
            vnpay_query_url="https://sandbox.example/querydr",
            vnpay_server_ip="127.0.0.1",
        ),
    )
    payment = await _create_querydr_pending_order(billing_session)

    async def send_query(settings_arg, payload):
        return _signed_querydr_response(**response_kwargs)

    monkeypatch.setattr(billing, "_send_querydr", send_query)

    assert await billing.query_vnpay_and_reconcile(
        billing_session,
        order_code=payment.order_code,
        ip_address="127.0.0.1",
    ) == "pending"
    await billing_session.refresh(payment)
    assert payment.status == "pending"
    assert (
        await billing_session.execute(
            select(Subscription).where(Subscription.user_id == "student-querydr")
        )
    ).scalar_one_or_none() is None


def test_vietnam_daily_reset_is_midnight_utc_plus_seven():
    from datetime import date

    assert billing._reset_at(date(2026, 9, 26)) == "2026-09-27T00:00:00+07:00"
