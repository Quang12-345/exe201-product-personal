import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { HOME_BY_ROLE } from "../services/authService";
import { GOOGLE_CLIENT_ID } from "../../../constants";
import { EyeIcon, EyeOffIcon } from "../../../components/common/icons.jsx";
import { ALLOWED_ADMIN_SUFFIXES, checkAdminSuffix } from "../utils/adminAuth.js";
import "./LoginPage.css";

// Biểu tượng Logo StudyMind (Tia sét với tia sao phát sáng)
function StudyMindLogo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
      <path
        d="M 153.52 51.44 H 356.87 V 75.55 A 186.18 186.18 0 0 0 177.63 255.60 H 153.52 Z"
        fill="#FFFFFF"
      />
      <path
        d="M 356.87 460.56 H 153.52 V 436.45 A 186.18 186.18 0 0 0 332.76 256.40 H 356.87 Z"
        fill="#FFFFFF"
      />
      <path
        d="M 290.96 166.38 L 307.84 166.38 L 289.36 204.16 C 293.05 205.60, 271.59 233.66, 317.49 243.54 L 310.25 258.01 C 253.03 270.63, 258.01 284.77, 243.54 298.20 L 224.25 335.17 L 207.37 335.17 L 225.86 297.39 C 222.16 295.95, 243.62 267.90, 197.73 258.01 L 204.96 243.54 C 262.19 230.92, 257.21 216.78, 271.67 203.35 Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

// Biểu tượng Huy hiệu / Dải ruy băng Giảng viên
function LecturerBadgeIcon({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#000000"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="5" />
      <path d="M8.2 12.5L6.5 21L12 18.5L17.5 21L15.8 12.5" />
    </svg>
  );
}

// Biểu tượng Người dùng / Sinh viên
function StudentProfileIcon({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#000000"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="7" r="4.2" />
      <path d="M5.5 20.5a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

// Biểu tượng Khiên Quản trị viên (Admin)
function AdminBadgeIcon({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#000000"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

// Nút chọn Radio (Đã chọn)
function RadioChecked() {
  return (
    <span className="studymind-radio studymind-radio--checked" aria-hidden="true">
      <span className="studymind-radio-inner" />
    </span>
  );
}

// Nút chọn Radio (Chưa chọn)
function RadioUnchecked() {
  return <span className="studymind-radio studymind-radio--unchecked" aria-hidden="true" />;
}

// Biểu tượng Google 4 màu
function GoogleLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.665-5.17 3.665-9.12z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.13z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.13c.95-2.83 3.6-4.96 6.72-4.96z"
      />
    </svg>
  );
}

function LoginPage() {
  const { login, loginWithGoogle, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Mặc định chọn Giảng viên (khớp với ảnh mẫu) hoặc đọc từ bộ nhớ
  const [selectedRole, setSelectedRole] = useState(() => {
    return localStorage.getItem("studymind_selected_role") || "lecturer";
  });

  const [form, setForm] = useState({
    username: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(
    location.state?.successMessage || ""
  );
  const [loading, setLoading] = useState(false);
  const googleBtnRef = useRef(null);

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    localStorage.setItem("studymind_selected_role", role);
    setError(null);
  };

  const change = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  // Trạng thái kiểm tra đuôi email khi ở vai trò Quản trị viên
  const adminSuffixStatus = checkAdminSuffix(form.username);

  // Gắn nhanh đuôi email được cấp phép khi nhấn chip
  const handleApplySuffix = (suffix) => {
    setForm((f) => {
      const current = f.username.trim();
      if (!current) {
        return { ...f, username: `admin${suffix}` };
      }
      if (current.includes("@")) {
        const prefix = current.split("@")[0];
        return { ...f, username: `${prefix}${suffix}` };
      }
      return { ...f, username: `${current}${suffix}` };
    });
    setError(null);
  };

  const isStudentRole = (role) => role === "student" || role === "SV";
  const isLecturerRole = (role) => role === "lecturer" || role === "GV";
  const isAdminRole = (role) => role === "admin" || role === "OPS";

  // Điều hướng sau khi đăng nhập thành công theo vai trò
  const goAfterLogin = (session) => {
    const role = session?.user?.role;
    if (!role || isStudentRole(role)) {
      try {
        sessionStorage.setItem("dmrs_start_new_chat", "1");
      } catch {
        /* ignore */
      }
      navigate("/student", { replace: true });
      return;
    }
    if (isAdminRole(role)) {
      navigate("/admin", { replace: true });
      return;
    }
    const home = HOME_BY_ROLE[role] || "/";
    const from = location.state?.from?.pathname;
    navigate(from && from.startsWith(home) ? from : home, { replace: true });
  };

  // Kiểm tra vai trò thực tế của tài khoản so với vai trò người dùng đã chọn trên giao diện
  const verifyRoleMismatch = (session, intendedRole) => {
    const actualRole = session?.user?.role;

    if (intendedRole === "admin") {
      if (!isAdminRole(actualRole)) {
        logout();
        setError(
          'Tài khoản này không có quyền Quản trị viên (Admin). Vui lòng chọn đúng vai trò "Tôi là Giảng viên" hoặc "Tôi là Sinh viên" để đăng nhập.'
        );
        return false;
      }
      return true;
    }

    if (intendedRole === "lecturer") {
      if (isAdminRole(actualRole)) {
        logout();
        setError(
          'Đây là tài khoản Quản trị viên (Admin). Vui lòng chuyển sang vai trò "Quản trị viên" để truy cập bảng điều khiển quản trị.'
        );
        return false;
      }
      if (!isLecturerRole(actualRole)) {
        logout();
        setError(
          'Tài khoản này là tài khoản Sinh viên. Vui lòng chuyển sang vai trò "Tôi là Sinh viên" để đăng nhập.'
        );
        return false;
      }
      return true;
    }

    if (intendedRole === "student") {
      if (isAdminRole(actualRole)) {
        logout();
        setError(
          'Đây là tài khoản Quản trị viên (Admin). Vui lòng chuyển sang vai trò "Quản trị viên" để truy cập bảng điều khiển quản trị.'
        );
        return false;
      }
      if (isLecturerRole(actualRole)) {
        logout();
        setError(
          'Tài khoản này là tài khoản Giảng viên. Vui lòng chuyển sang vai trò "Tôi là Giảng viên" để đăng nhập.'
        );
        return false;
      }
      return true;
    }

    return true;
  };

  const isPendingUser = (user) =>
    String(user?.status || "").toLowerCase() === "pending";

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage("");

    const usernameVal = form.username.trim();

    // Kiểm tra định dạng đuôi email nếu đang ở vai trò Admin
    if (selectedRole === "admin") {
      const suffixCheck = checkAdminSuffix(usernameVal);
      if (!suffixCheck.valid) {
        setError(
          `Đăng nhập Quản trị viên yêu cầu đuôi email được cấp phép (${ALLOWED_ADMIN_SUFFIXES.join(
            ", "
          )}) hoặc tài khoản 'admin'.`
        );
        return;
      }
    }

    setLoading(true);

    try {
      const session = await login({
        username: usernameVal,
        password: form.password,
      });

      if (isPendingUser(session?.user)) {
        navigate("/update-password", { replace: true });
        return;
      }

      // Kiểm tra logic vai trò đúng như người dùng đã chọn
      if (!verifyRoleMismatch(session, selectedRole)) {
        return;
      }

      goAfterLogin(session);
    } catch (err) {
      if (err.message === "ACCOUNT_PENDING") {
        navigate("/forgot-password", {
          state: { email: usernameVal, activation: true },
        });
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Khởi tạo Google Identity Services
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || selectedRole === "admin") return;
    let cancelled = false;
    let timer;

    const render = () => {
      if (cancelled || !window.google?.accounts?.id || !googleBtnRef.current)
        return false;

      console.log('[Google Auth] Đang khởi tạo Google Login với Client ID:', GOOGLE_CLIENT_ID);
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (resp) => {
          setError(null);
          setSuccessMessage("");
          setLoading(true);
          try {
            const session = await loginWithGoogle(resp.credential);
            if (isPendingUser(session?.user)) {
              navigate("/update-password", { replace: true });
              return;
            }

            // Với Giảng viên: tài khoản Google phải có vai trò Giảng viên trong hệ thống
            if (
              selectedRole === "lecturer" &&
              !isLecturerRole(session?.user?.role) &&
              !isAdminRole(session?.user?.role)
            ) {
              logout();
              setError(
                'Tài khoản Google này là tài khoản Sinh viên (chưa được cấp quyền Giảng viên). Vui lòng chọn vai trò "Tôi là Sinh viên" hoặc đăng nhập tài khoản Giảng viên đã được cấp.'
              );
              return;
            }

            if (!verifyRoleMismatch(session, selectedRole)) {
              return;
            }

            goAfterLogin(session);
          } catch (err) {
            setError(err.message);
          } finally {
            setLoading(false);
          }
        },
      });

      googleBtnRef.current.innerHTML = "";
      const containerWidth =
        googleBtnRef.current.parentElement?.offsetWidth ||
        googleBtnRef.current.offsetWidth ||
        360;
      const width = Math.max(240, Math.min(400, Math.floor(containerWidth)));

      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "outline",
        size: "large",
        width,
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        locale: "vi",
      });
      return true;
    };

    if (!render()) {
      timer = setInterval(() => {
        if (render()) clearInterval(timer);
      }, 200);
      setTimeout(() => clearInterval(timer), 5000);
    }

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selectedRole, loginWithGoogle, logout]);

  // Hỗ trợ điền nhanh tài khoản demo để kiểm thử
  const fillDemoAccount = (role) => {
    if (role === "lecturer") {
      handleRoleSelect("lecturer");
      setForm({
        username: "lecturer@ai20k.vn",
        password: "lecturer123",
      });
    } else if (role === "student") {
      handleRoleSelect("student");
      setForm({
        username: "student@ai20k.vn",
        password: "student123",
      });
    } else if (role === "admin") {
      handleRoleSelect("admin");
      setForm({
        username: "admin@ai20k.vn",
        password: "admin123",
      });
    }
    setError(null);
  };

  return (
    <div className="studymind-login-page">
      <div className="studymind-card">
        {/* Top Logo */}
        <div className="studymind-logo-wrap">
          <div className="studymind-logo-box">
            <StudyMindLogo size={30} />
          </div>
        </div>

        {/* Tiêu đề & Giới thiệu */}
        <h1 className="studymind-title">Chào mừng đến StudyMind</h1>
        <p className="studymind-subtitle">Nền tảng học tập thông minh AI</p>

        {/* Thông báo phản hồi */}
        {successMessage && (
          <div className="studymind-alert studymind-alert--success">
            {successMessage}
          </div>
        )}
        {error && <div className="studymind-alert studymind-alert--error">{error}</div>}

        {/* KHỐI CHỌN VAI TRÒ */}
        <div className="studymind-role-section">
          <div className="studymind-role-label">CHỌN VAI TRÒ CỦA BẠN</div>
          <div className="studymind-role-grid">
            {/* Card Giảng viên */}
            <button
              type="button"
              className={`studymind-role-card ${
                selectedRole === "lecturer" ? "is-selected" : ""
              }`}
              onClick={() => handleRoleSelect("lecturer")}
              aria-pressed={selectedRole === "lecturer"}
            >
              <div className="studymind-role-card-top">
                <span className="studymind-role-icon">
                  <LecturerBadgeIcon size={24} />
                </span>
                <span className="studymind-role-radio">
                  {selectedRole === "lecturer" ? (
                    <RadioChecked />
                  ) : (
                    <RadioUnchecked />
                  )}
                </span>
              </div>
              <div className="studymind-role-text">Tôi là Giảng viên</div>
            </button>

            {/* Card Sinh viên */}
            <button
              type="button"
              className={`studymind-role-card ${
                selectedRole === "student" ? "is-selected" : ""
              }`}
              onClick={() => handleRoleSelect("student")}
              aria-pressed={selectedRole === "student"}
            >
              <div className="studymind-role-card-top">
                <span className="studymind-role-icon">
                  <StudentProfileIcon size={24} />
                </span>
                <span className="studymind-role-radio">
                  {selectedRole === "student" ? (
                    <RadioChecked />
                  ) : (
                    <RadioUnchecked />
                  )}
                </span>
              </div>
              <div className="studymind-role-text">Tôi là Sinh viên</div>
            </button>

            {/* Card Quản trị viên (Admin) */}
            <button
              type="button"
              className={`studymind-role-card studymind-role-card--admin ${
                selectedRole === "admin" ? "is-selected" : ""
              }`}
              onClick={() => handleRoleSelect("admin")}
              aria-pressed={selectedRole === "admin"}
            >
              <div className="studymind-role-card-top">
                <div className="studymind-role-admin-header">
                  <span className="studymind-role-icon">
                    <AdminBadgeIcon size={22} />
                  </span>
                  <span className="studymind-role-admin-badge">ADMIN PORTAL</span>
                </div>
                <span className="studymind-role-radio">
                  {selectedRole === "admin" ? (
                    <RadioChecked />
                  ) : (
                    <RadioUnchecked />
                  )}
                </span>
              </div>
              <div className="studymind-role-text">Tôi là Quản trị viên (Admin)</div>
            </button>
          </div>
        </div>

        {/* Khung thông tin xác thực Quản trị viên */}
        {selectedRole === "admin" && (
          <div className="studymind-admin-box">
            <div className="studymind-admin-box-title">
              <AdminBadgeIcon size={18} />
              <span>Cổng Quản trị viên hệ thống</span>
            </div>
            <p className="studymind-admin-box-desc">
              Chỉ dành cho Ban Quản trị & Kỹ thuật. Đăng nhập yêu cầu tài khoản có đuôi hợp lệ:
            </p>
            <div className="studymind-admin-domains">
              <span className="studymind-admin-domains-label">Đuôi được cấp phép:</span>
              {ALLOWED_ADMIN_SUFFIXES.map((suffix) => (
                <button
                  key={suffix}
                  type="button"
                  className="studymind-admin-domain-chip"
                  onClick={() => handleApplySuffix(suffix)}
                  title={`Nhấn để tự động gắn đuôi ${suffix}`}
                >
                  {suffix}
                </button>
              ))}
              <button
                type="button"
                className="studymind-admin-domain-chip"
                onClick={() => {
                  setForm((f) => ({ ...f, username: "admin" }));
                  setError(null);
                }}
                title="Nhấn để điền tài khoản 'admin'"
              >
                user: admin
              </button>
            </div>
          </div>
        )}

        {/* Form Đăng nhập */}
        <form className="studymind-form" onSubmit={submit}>
          {/* Email field */}
          <div className="studymind-field">
            <label className="studymind-field-label" htmlFor="username">
              {selectedRole === "admin"
                ? "Tài khoản / Email Quản trị viên"
                : selectedRole === "lecturer"
                ? "Địa chỉ email Giảng viên"
                : "Địa chỉ email Sinh viên"}
            </label>
            <input
              id="username"
              name="username"
              type="text"
              className={`studymind-input ${
                selectedRole === "admin" && form.username.trim()
                  ? adminSuffixStatus.valid
                    ? "studymind-input--valid"
                    : "studymind-input--invalid"
                  : ""
              }`}
              value={form.username}
              onChange={change}
              placeholder={
                selectedRole === "admin"
                  ? "admin@ai20k.vn hoặc admin"
                  : selectedRole === "lecturer"
                  ? "lecturer@ai20k.vn"
                  : "AnNN123@fpt.edu.vn"
              }
              autoComplete="username"
              required
              autoFocus
            />
            {/* Phản hồi kiểm tra đuôi thời gian thực khi chọn Admin */}
            {selectedRole === "admin" && form.username.trim() && (
              <div
                className={`studymind-suffix-feedback ${
                  adminSuffixStatus.valid
                    ? "studymind-suffix-feedback--valid"
                    : "studymind-suffix-feedback--invalid"
                }`}
              >
                {adminSuffixStatus.valid ? (
                  <span>✓ {adminSuffixStatus.message}</span>
                ) : (
                  <span>⚠️ {adminSuffixStatus.message}</span>
                )}
              </div>
            )}
          </div>

          {/* Mật khẩu field */}
          <div className="studymind-field">
            <div className="studymind-label-row">
              <label className="studymind-field-label" htmlFor="password">
                Mật khẩu
              </label>
              <Link className="studymind-forgot-link" to="/forgot-password">
                Quên mật khẩu?
              </Link>
            </div>
            <div className="studymind-input-wrap">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                className="studymind-input studymind-input--password"
                value={form.password}
                onChange={change}
                placeholder="••••••••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="studymind-eye-btn"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
              </button>
            </div>
          </div>

          {/* Nút Đăng nhập */}
          <button
            type="submit"
            className={`studymind-btn-primary ${
              selectedRole === "admin" ? "studymind-btn-primary--admin" : ""
            }`}
            disabled={loading}
          >
            {loading ? (
              "Đang xác thực..."
            ) : selectedRole === "admin" ? (
              <span className="studymind-btn-content">
                <AdminBadgeIcon size={18} />
                <span>Đăng nhập Quản trị viên</span>
              </span>
            ) : (
              "Đăng nhập"
            )}
          </button>
        </form>

        {/* Khối Đăng nhập Google hoặc Cảnh báo bảo mật Quản trị viên */}
        {selectedRole === "admin" ? (
          <div className="studymind-admin-security-note">
            <div className="studymind-security-title">
              <span className="studymind-security-icon">🛡️</span>
              <span>Chính sách bảo mật Quản trị viên</span>
            </div>
            <p>
              Đăng nhập qua Google bị tắt ở cổng Quản trị viên theo tiêu chuẩn an ninh hệ thống. Vui lòng xác thực bằng tài khoản và mật khẩu quản trị được cấp.
            </p>
          </div>
        ) : (
          <>
            {/* Divider */}
            <div className="studymind-divider">
              <span>hoặc tiếp tục với</span>
            </div>

            {/* Nút Google */}
            <div className="studymind-google-container">
              {GOOGLE_CLIENT_ID ? (
                <div className="studymind-google-wrapper">
                  <div
                    ref={googleBtnRef}
                    className="studymind-google-btn-rendered"
                    title="Đăng nhập với Google"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  className="studymind-btn-google"
                  onClick={() => {
                    setError(
                      "Chưa cấu hình Google Client ID (VITE_GOOGLE_CLIENT_ID). Bạn có thể bấm 'Sinh viên Demo' bên dưới để đăng nhập ngay."
                    );
                  }}
                  title="Chưa cấu hình Google Client ID"
                >
                  <GoogleLogo size={20} />
                  <span>Tiếp tục với Google</span>
                </button>
              )}
            </div>
          </>
        )}

        {/* Thanh trợ giúp tài khoản thử nghiệm nhanh */}
        <div className="studymind-demo-helper">
          <span className="studymind-demo-label">Thử nghiệm nhanh:</span>
          <button
            type="button"
            className="studymind-demo-chip"
            onClick={() => fillDemoAccount("lecturer")}
          >
            Giảng viên Demo
          </button>
          <button
            type="button"
            className="studymind-demo-chip"
            onClick={() => fillDemoAccount("student")}
          >
            Sinh viên Demo
          </button>
          <button
            type="button"
            className="studymind-demo-chip studymind-demo-chip--admin"
            onClick={() => fillDemoAccount("admin")}
          >
            🛡️ Admin Demo
          </button>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;