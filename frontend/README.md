# Frontend — DMRS System

Front-end React (JavaScript) + Vite cho **Hệ thống quản lý dữ liệu DMRS**.
Giao tiếp với Back-end / AI qua REST API. Người dùng sản phẩm: **Giảng viên** và **Sinh viên**. Tài khoản `admin` là console vận hành/dev, toàn quyền.

## Yêu cầu

- Node.js **>= 18** (khuyến nghị 20 LTS) · npm **>= 9**
- Kiểm tra: `node -v` và `npm -v` — tải tại https://nodejs.org

> Chi tiết thêm xem [REQUIREMENTS.txt](./REQUIREMENTS.txt). FE dùng `package.json` + `npm`,
> không dùng `requirements.txt`/pip (đó là của Back-end Python).

## Cài đặt & chạy

```bash
cd frontend
npm install            # cài thư viện (chạy lần đầu, đọc từ package.json)
cp .env.example .env   # cấu hình VITE_API_URL trỏ tới Back-end
npm run dev            # dev server: http://localhost:5173
```

Lệnh khác: `npm run build` (build vào `dist/`), `npm run preview`, `npm run lint`.

## Tài khoản demo (mock phía FE — chưa nối API)

| Vai trò | Tài khoản | Mật khẩu | Khu vực |
|---|---|---|---|
| Giảng viên | `lecturer` | `lecturer123` | `/lecturer` |
| Sinh viên | `student` | `student123` | `/student` |
| Vận hành (dev/ops) | `admin` | `admin123` | `/admin` |

Đăng nhập tại `http://localhost:5173/login` → tự điều hướng theo vai trò.

## Cấu trúc thư mục

```
src/
├── components/common/      # UI + bộ icon SVG dùng chung (icons.jsx)
├── features/               # tổ chức theo TÍNH NĂNG / VAI TRÒ
│   ├── auth/               #   đăng nhập, quên mật khẩu, AuthContext, ProtectedRoute, UserMenu
│   ├── theme/              #   sáng/tối (ThemeContext, ThemeToggle, theme.css)
│   ├── admin/              #   khu Quản trị (layout + pages + services + admin.css)
│   ├── lecturer/           #   khu Giảng viên
│   └── student/            #   khu Sinh viên
│       ├── components/     #     layout, sidebar, topbar, ...
│       ├── pages/          #     mỗi màn 1 file
│       ├── services/       #     gọi API (HIỆN TẠI: mock)
│       ├── hooks/          #     tách logic khỏi UI
│       └── styles/         #     CSS riêng của feature
├── services/api.js         # axios instance dùng chung (baseURL = VITE_API_URL)
├── constants/              # API_URL, ENDPOINTS
├── routes/AppRoutes.jsx    # routing cấp app: /login, /admin/*, /lecturer/*, /student/*
├── App.jsx                 # bọc ThemeProvider + AuthProvider + routes
└── main.jsx                # entry point
```

## Quy ước

- **Mỗi component / page / hook / service = 1 file riêng.** File phình to → tách nhỏ.
- Component **không gọi API trực tiếp** → qua `services/` (axios instance `services/api.js`).
- Logic state/đa-bước → đẩy vào `hooks/`, component chỉ lo hiển thị.
- **Không hard-code URL/secret** → dùng biến `VITE_*` + `constants/`.
- Thêm vai trò mới = thêm 1 thư mục `features/<role>/` + 1 route + 1 dòng tài khoản
  (auth/theme/layout đã tái dùng được).

## Ghép API (việc còn lại)

Giao diện đã xong; dữ liệu hiện là **mock** trong các file `*/services/*.js`.
Để nối Back-end, chỉ cần thay phần thân hàm trong các service đó bằng lời gọi `api.*`:

- [features/auth/services/authService.js](src/features/auth/services/authService.js) → `POST /auth/login` (token + role)
- `features/{admin,lecturer,student}/services/*.js` → các endpoint tương ứng
- Gắn `Authorization: Bearer <token>` vào interceptor trong [services/api.js](src/services/api.js); xử lý 401 → `/login`

Component/page/hook **không phải sửa** — đó là lợi ích của việc tách lớp.
