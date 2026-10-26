from pydantic import BaseModel, Field

from src.models.user import LoginUser


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=1, max_length=255)


class GmailLoginRequest(BaseModel):
    credential: str = Field(..., min_length=1)


class LoginResponse(BaseModel):
    token: str
    token_type: str = "bearer"
    user: LoginUser


class GmailLoginResponse(BaseModel):
    access_token: str
    token: str | None = None
    token_type: str = "bearer"
    user: LoginUser

    def model_post_init(self, __context) -> None:
        if not self.token and self.access_token:
            self.token = self.access_token


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=255)


class ForgotPasswordResponse(BaseModel):
    ok: bool
    email: str
    message: str


class VerifyOtpRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=255)
    otp_code: str = Field(..., min_length=6, max_length=6)


class VerifyOtpResponse(BaseModel):
    ok: bool
    email: str
    message: str


class ResetPasswordRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=255)
    otp_code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=1, max_length=72)


class ResetPasswordResponse(BaseModel):
    ok: bool
    email: str
    message: str


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=8, max_length=72)
    name: str = Field(..., min_length=1, max_length=255)


class RegisterResponse(BaseModel):
    ok: bool
    email: str
    message: str


class RegisterVerifyRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=255)
    otp_code: str = Field(..., min_length=6, max_length=6)


class RegisterResendRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=255)
