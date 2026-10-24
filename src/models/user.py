from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LoginUser(BaseModel):
    id: str
    username: str
    email: str
    name: str
    role: str | None = None
    phone: str | None = None
    status: str


class RoleResponse(BaseModel):
    id: str
    name: str
    code: str
    displayName: str
    description: str = ""
    isProduct: bool
    isAssignable: bool


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    name: str
    roleID: str | None = None
    roleName: str | None = None
    roleCode: str | None = None
    roleLabel: str | None = None
    phone: str | None = None
    status: str
    documentCount: int = 0
    joinedAt: datetime | None = None
    initialPassword: str | None = None
    plan: str = "free"
    isPro: bool = False
    subscriptionExpiresAt: datetime | None = None


class CreateUserRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=255)
    username: str | None = Field(default=None, max_length=150)  # trống → lấy phần trước @ email
    password: str | None = Field(default=None, min_length=6, max_length=72)
    name: str = Field(..., min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    role: str | None = Field(default=None, max_length=50)
    status: str = Field(default="active", max_length=32)


class UpdateUserRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str | None = Field(default=None, min_length=1, max_length=255)
    username: str | None = Field(default=None, max_length=150)
    password: str | None = Field(default=None, min_length=6, max_length=72)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    role: str | None = Field(default=None, max_length=50)
    status: str | None = Field(default=None, min_length=1, max_length=32)
    plan: str | None = Field(default=None, max_length=32)


class ChangePasswordRequest(BaseModel):
    """Đổi mật khẩu của CHÍNH MÌNH — cách duy nhất user thường được tự cập nhật tài khoản."""
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=1, max_length=72)
    new_password: str = Field(min_length=6, max_length=72)
