from html import escape


def get_account_credentials_template(
    *, name: str, username: str, password: str, login_url: str | None = None
) -> str:
    """Email gửi thông tin đăng nhập cho tài khoản do admin tạo."""
    e_name = escape(name or "bạn")
    e_user = escape(username)
    e_pass = escape(password)
    login_btn = (
        f'<tr><td align="center" style="padding:4px 32px 28px 32px;">'
        f'<a href="{escape(login_url)}" style="display:inline-block; background-color:#1d4ed8; color:#ffffff; '
        f'text-decoration:none; font-size:15px; font-weight:600; padding:12px 28px; border-radius:10px;">Đăng nhập ngay</a>'
        f"</td></tr>"
        if login_url
        else ""
    )
    return f"""\
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thông tin tài khoản DMRS</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f3f6fb; font-family:Arial, Helvetica, sans-serif; color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f6fb; margin:0; padding:0;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px; background-color:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #e5e7eb;">
            <tr>
              <td style="background-color:#1d4ed8; padding:28px 32px; text-align:center;">
                <div style="font-size:22px; font-weight:700; color:#ffffff; letter-spacing:0.5px;">DMRS</div>
                <div style="font-size:13px; color:#dbeafe; margin-top:6px;">Trung tâm tri thức</div>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 32px 12px 32px;">
                <h1 style="margin:0 0 18px 0; font-size:24px; line-height:1.3; color:#111827; font-weight:700;">Tài khoản của bạn đã được tạo</h1>
                <p style="margin:0 0 16px 0; font-size:15px; line-height:1.7; color:#374151;">Xin chào {e_name},</p>
                <p style="margin:0 0 16px 0; font-size:15px; line-height:1.7; color:#374151;">Quản trị viên đã tạo cho bạn một tài khoản trên hệ thống DMRS. Dùng thông tin bên dưới để đăng nhập:</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#eff6ff; border:1px solid #bfdbfe; border-radius:12px;">
                  <tr><td style="padding:18px 20px 8px 20px; font-size:13px; color:#1d4ed8; text-transform:uppercase; font-weight:700; letter-spacing:1px;">Tên đăng nhập</td></tr>
                  <tr><td style="padding:0 20px 14px 20px; font-size:18px; color:#111827; font-weight:700;">{e_user}</td></tr>
                  <tr><td style="padding:0 20px 8px 20px; font-size:13px; color:#1d4ed8; text-transform:uppercase; font-weight:700; letter-spacing:1px;">Mật khẩu</td></tr>
                  <tr><td style="padding:0 20px 18px 20px; font-size:18px; color:#111827; font-weight:700;">{e_pass}</td></tr>
                </table>
              </td>
            </tr>
            {login_btn}
            <tr>
              <td style="padding:0 32px 32px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:10px; border:1px solid #e5e7eb;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <p style="margin:0 0 10px 0; font-size:14px; line-height:1.6; color:#4b5563;">Tài khoản sẽ <strong style="color:#111827;">tự kích hoạt</strong> ở lần đăng nhập đầu tiên.</p>
                      <p style="margin:0 0 10px 0; font-size:14px; line-height:1.6; color:#4b5563;">Vì lý do bảo mật, bạn nên <strong style="color:#111827;">đổi mật khẩu</strong> sau khi đăng nhập.</p>
                      <p style="margin:0; font-size:14px; line-height:1.6; color:#4b5563;">Vui lòng không trả lời email này.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background-color:#f8fafc; padding:22px 32px; text-align:center; border-top:1px solid #e5e7eb;">
                <p style="margin:0; font-size:12px; line-height:1.6; color:#6b7280;">&copy; 2026 DMRS. Bảo lưu mọi quyền.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def get_email_verification_template(otp: str) -> str:
    escaped_otp = escape(otp)
    return f"""\
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Xác nhận tài khoản DMRS</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f3f6fb; font-family:Arial, Helvetica, sans-serif; color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f6fb; margin:0; padding:0;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px; background-color:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #e5e7eb;">
            <tr>
              <td style="background-color:#1d4ed8; padding:28px 32px; text-align:center;">
                <div style="font-size:22px; font-weight:700; color:#ffffff; letter-spacing:0.5px;">DMRS</div>
                <div style="font-size:13px; color:#dbeafe; margin-top:6px;">Xác nhận tài khoản</div>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 32px 12px 32px;">
                <h1 style="margin:0 0 18px 0; font-size:24px; line-height:1.3; color:#111827; font-weight:700;">Xác nhận địa chỉ Gmail</h1>
                <p style="margin:0 0 16px 0; font-size:15px; line-height:1.7; color:#374151;">Xin chào,</p>
                <p style="margin:0 0 16px 0; font-size:15px; line-height:1.7; color:#374151;">Bạn vừa đăng ký tài khoản DMRS. Dùng mã OTP bên dưới để xác nhận Gmail và kích hoạt tài khoản.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 32px 28px 32px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:360px;">
                  <tr>
                    <td align="center" style="background-color:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:22px 16px;">
                      <div style="font-size:12px; line-height:1.4; color:#1d4ed8; text-transform:uppercase; font-weight:700; letter-spacing:1.4px; margin-bottom:10px;">Mã xác thực</div>
                      <div style="font-size:34px; line-height:1; color:#111827; font-weight:700; letter-spacing:8px; font-family:Arial, Helvetica, sans-serif;">{escaped_otp}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:10px; border:1px solid #e5e7eb;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <p style="margin:0 0 10px 0; font-size:14px; line-height:1.6; color:#4b5563;">Mã OTP này hết hạn sau <strong style="color:#111827;">5 phút</strong>.</p>
                      <p style="margin:0 0 10px 0; font-size:14px; line-height:1.6; color:#4b5563;">Nếu bạn không đăng ký tài khoản, vui lòng bỏ qua email này.</p>
                      <p style="margin:0; font-size:14px; line-height:1.6; color:#4b5563;">Vui lòng không trả lời email này.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background-color:#f8fafc; padding:22px 32px; text-align:center; border-top:1px solid #e5e7eb;">
                <p style="margin:0; font-size:12px; line-height:1.6; color:#6b7280;">&copy; 2026 DMRS. Bảo lưu mọi quyền.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def get_password_reset_template(otp: str) -> str:
    escaped_otp = escape(otp)
    return f"""\
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Yêu cầu đặt lại mật khẩu</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f3f6fb; font-family:Arial, Helvetica, sans-serif; color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f6fb; margin:0; padding:0;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px; background-color:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #e5e7eb;">
            <tr>
              <td style="background-color:#1d4ed8; padding:28px 32px; text-align:center;">
                <div style="font-size:22px; font-weight:700; color:#ffffff; letter-spacing:0.5px;">DMRS</div>
                <div style="font-size:13px; color:#dbeafe; margin-top:6px;">Bảo mật tài khoản</div>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 32px 12px 32px;">
                <h1 style="margin:0 0 18px 0; font-size:24px; line-height:1.3; color:#111827; font-weight:700;">Yêu cầu đặt lại mật khẩu</h1>
                <p style="margin:0 0 16px 0; font-size:15px; line-height:1.7; color:#374151;">Xin chào,</p>
                <p style="margin:0 0 16px 0; font-size:15px; line-height:1.7; color:#374151;">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
                <p style="margin:0 0 26px 0; font-size:15px; line-height:1.7; color:#374151;">Vui lòng dùng mã xác thực bên dưới để tiếp tục quá trình đặt lại mật khẩu.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 32px 28px 32px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:360px;">
                  <tr>
                    <td align="center" style="background-color:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:22px 16px;">
                      <div style="font-size:12px; line-height:1.4; color:#1d4ed8; text-transform:uppercase; font-weight:700; letter-spacing:1.4px; margin-bottom:10px;">Mã xác thực</div>
                      <div style="font-size:34px; line-height:1; color:#111827; font-weight:700; letter-spacing:8px; font-family:Arial, Helvetica, sans-serif;">{escaped_otp}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:10px; border:1px solid #e5e7eb;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <p style="margin:0 0 10px 0; font-size:14px; line-height:1.6; color:#4b5563;">Mã OTP này hết hạn sau <strong style="color:#111827;">5 phút</strong>.</p>
                      <p style="margin:0 0 10px 0; font-size:14px; line-height:1.6; color:#4b5563;">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
                      <p style="margin:0; font-size:14px; line-height:1.6; color:#4b5563;">Vui lòng không trả lời email này.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background-color:#f8fafc; padding:22px 32px; text-align:center; border-top:1px solid #e5e7eb;">
                <p style="margin:0; font-size:12px; line-height:1.6; color:#6b7280;">&copy; 2026 DMRS. Bảo lưu mọi quyền.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def get_account_created_template(username: str, password: str) -> str:
    escaped_username = escape(username)
    escaped_password = escape(password)
    return f"""\
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tài khoản DMRS của bạn</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f3f6fb; font-family:Arial, Helvetica, sans-serif; color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f6fb; margin:0; padding:0;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px; background-color:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #e5e7eb;">
            <tr>
              <td style="background-color:#1d4ed8; padding:28px 32px; text-align:center;">
                <div style="font-size:22px; font-weight:700; color:#ffffff; letter-spacing:0.5px;">DMRS</div>
                <div style="font-size:13px; color:#dbeafe; margin-top:6px;">Thông tin tài khoản</div>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 32px 12px 32px;">
                <h1 style="margin:0 0 18px 0; font-size:24px; line-height:1.3; color:#111827; font-weight:700;">Tài khoản của bạn đã được tạo</h1>
                <p style="margin:0 0 16px 0; font-size:15px; line-height:1.7; color:#374151;">Xin chào,</p>
                <p style="margin:0 0 20px 0; font-size:15px; line-height:1.7; color:#374151;">Quản trị viên đã tạo tài khoản DMRS cho bạn. Vui lòng dùng thông tin dưới đây để đăng nhập lần đầu.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#eff6ff; border:1px solid #bfdbfe; border-radius:12px;">
                  <tr>
                    <td style="padding:18px 20px; font-size:14px; line-height:1.7; color:#1f2937;">
                      <div><strong>Tài khoản:</strong> {escaped_username}</div>
                      <div><strong>Mật khẩu:</strong> {escaped_password}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px 32px;">
                <p style="margin:0; font-size:14px; line-height:1.7; color:#4b5563;">Tài khoản đang ở trạng thái chờ kích hoạt. Sau khi đăng nhập, bạn sẽ được yêu cầu cập nhật mật khẩu để kích hoạt tài khoản.</p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#f8fafc; padding:22px 32px; text-align:center; border-top:1px solid #e5e7eb;">
                <p style="margin:0; font-size:12px; line-height:1.6; color:#6b7280;">&copy; 2026 DMRS. Bảo lưu mọi quyền.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""
