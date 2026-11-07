"""Công cụ CLI kiểm tra và đối soát tự động các giao dịch PayOS, kích hoạt Gói Pro.

Sử dụng:
    python scripts/reconcile_payos.py
    python scripts/reconcile_payos.py --order-code 1730991234567
"""

import argparse
import asyncio
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Thêm thư mục gốc dự án vào PYTHONPATH
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


async def run_reconciliation(order_code: int | None, days: int):
    from datetime import UTC, datetime, timedelta
    from sqlalchemy import select
    from src.db.models import PaymentTransaction, Subscription
    from src.db.session import AsyncSessionLocal
    from src.services.billing import query_payos_and_reconcile

    async with AsyncSessionLocal() as session:
        if order_code:
            stmt = select(PaymentTransaction).where(PaymentTransaction.order_code == order_code)
        else:
            cutoff = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=days)
            stmt = (
                select(PaymentTransaction)
                .where(
                    PaymentTransaction.provider == "payos",
                    PaymentTransaction.status == "pending",
                    PaymentTransaction.created_at >= cutoff,
                )
                .order_by(PaymentTransaction.created_at.desc())
            )

        result = await session.execute(stmt)
        transactions = result.scalars().all()

        if not transactions:
            print("Không tìm thấy giao dịch PayOS nào cần đối soát.")
            return

        print(f"Tìm thấy {len(transactions)} đơn hàng PayOS. Bắt đầu đối soát với PayOS API...")

        for tx in transactions:
            print(f"\n--- Đơn hàng #{tx.order_code} (User ID: {tx.user_id}) ---")
            print(f"Số tiền: {tx.amount:,} VND | Tạo lúc: {tx.created_at}")
            try:
                status = await query_payos_and_reconcile(session, order_code=tx.order_code)
                print(f"Kết quả đối soát PayOS: {status.upper()}")
                if status == "paid":
                    sub_stmt = select(Subscription).where(
                        Subscription.user_id == tx.user_id,
                        Subscription.status == "active",
                    )
                    sub_res = await session.execute(sub_stmt)
                    sub = sub_res.scalar_one_or_none()
                    exp = sub.expires_at.strftime("%d/%m/%Y %H:%M") if (sub and sub.expires_at) else "N/A"
                    print(f"-> Gói Pro ĐÃ KÍCH HOẠT THÀNH CÔNG! Hiệu lực đến: {exp}")
                else:
                    print("-> PayOS báo đơn chưa nhận được thanh toán hoặc đang xử lý.")
            except Exception as e:
                print(f"-> Lỗi khi truy vấn PayOS API: {e}")

        print("\nHoàn tất đối soát.")


def main():
    parser = argparse.ArgumentParser(description="Doi soat giao dich PayOS va kich hoat Pro.")
    parser.add_argument("--order-code", type=int, help="Ma don hang cu the can doi soat.")
    parser.add_argument("--days", type=int, default=7, help="So ngay tim kiem don pending (mac dinh 7 ngay).")
    args = parser.parse_args()

    asyncio.run(run_reconciliation(args.order_code, args.days))


if __name__ == "__main__":
    main()
