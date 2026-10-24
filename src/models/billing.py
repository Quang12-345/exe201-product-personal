from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class VnPayPaymentCreateRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={"examples": [{"plan_code": "pro_monthly"}]}
    )

    plan_code: Literal["pro_monthly"] = Field(
        default="pro_monthly",
        description="Gói Pro 1 tháng, giá cố định 99.000 VND. Không nhận user_id hoặc amount từ client.",
    )
    return_to: str | None = Field(
        default=None,
        description="Đường dẫn frontend để quay lại sau khi thanh toán",
    )


class VnPayPaymentCreateResponse(BaseModel):
    checkout_url: str = Field(description="URL chuyển hướng sang cổng thanh toán VNPay")
    payment_url: str | None = Field(
        default=None, description="Alias tương thích ngược cho checkout_url"
    )
    order_code: int = Field(description="Mã đơn thanh toán")
    amount: int = Field(description="Số tiền thanh toán, đơn vị VND")

    def model_post_init(self, __context):
        if not self.payment_url and self.checkout_url:
            self.payment_url = self.checkout_url


class VnPayReconcileResponse(BaseModel):
    order_code: int
    status: Literal["paid", "pending"]
    message: str
