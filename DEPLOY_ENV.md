# Cấu hình môi trường deploy — FE (Vercel) + BE (Render)

Code đã sẵn sàng. File này là phần **bạn tự làm trên dashboard**.

Thứ tự nên làm: **DB → Backend (Render) → Frontend (Vercel) → quay lại Render điền URL Vercel**.

> ⚠️ Không commit `.env` / `.env.example` có key thật. Nếu key OpenAI hoặc mật khẩu DB từng bị push lên GitHub → **đổi key ngay** (OpenAI dashboard / Supabase → Database → Reset password).

> ⚠️ `render.yaml` ghim `branch: main`. Code mới đang ở nhánh `fix-branch` → merge vào `main` (hoặc đổi nhánh trong Render) thì Render mới build.

---

## 1. Database

Chọn **một** trong hai:

**A. Dùng Postgres của Render** (tạo tự động từ `render.yaml`) → không cần làm gì, `DATABASE_URL` tự nối.
Lưu ý: Postgres free của Render hết hạn sau ~30 ngày.

**B. Dùng Supabase**
- Supabase → **Connect** → chọn **Session pooler** (KHÔNG dùng "Direct connection": nó chỉ có IPv6, Render không kết nối được).
- Copy URL dạng `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`
- Mật khẩu có ký tự đặc biệt (`! $ @ #`...) phải URL-encode (`!`→`%21`, `$`→`%24`, `@`→`%40`).
- Trên Render, đặt `DATABASE_URL` = URL này (ghi đè giá trị lấy từ `ai20k-db`). Khi đó có thể xoá DB `ai20k-db` cho gọn.

---

## 2. Backend — Render

### Cách tạo
Render → **New + → Blueprint** → chọn repo → Render đọc `render.yaml` và tạo `ai20k-backend` (Docker) + `ai20k-redis` (+ `ai20k-db`).
`render.yaml` đã **bỏ** service frontend (FE chạy trên Vercel).

### Biến môi trường (Environment Group `ai20k-shared` hoặc tab Environment của service)

| Biến | Bắt buộc | Giá trị |
|------|:-------:|---------|
| `OPENAI_API_KEY` | ✅ | key OpenAI |
| `QDRANT_URL` | ✅ | URL cluster Qdrant Cloud |
| `QDRANT_API_KEY` | ✅ | key Qdrant |
| `QDRANT_COLLECTION_NAME` | ✅ | đã có sẵn `project-db` (đổi nếu collection khác tên) |
| `DATABASE_URL` | ✅ | tự có (Render DB) hoặc URL Supabase pooler |
| `JWT_SECRET_KEY` | ✅ | Render tự sinh |
| `CORS_ORIGINS` | ✅ | URL Vercel production, vd. `https://ten-app.vercel.app` (nhiều URL cách nhau bằng dấu phẩy, **không** có `/` cuối) |
| `CORS_ORIGIN_REGEX` | ⬜ | đã đặt sẵn `https://.*\.vercel\.app` → cho phép mọi link preview Vercel. Muốn chặt hơn: `https://ten-app(-.*)?\.vercel\.app` |
| `FRONTEND_URL` | ✅ nếu dùng VNPay | URL Vercel (backend redirect về đây sau thanh toán) |
| `GOOGLE_CLIENT_ID` | ⬜ | Client ID Google OAuth (đăng nhập Gmail) |
| `BREVO_API_KEY`, `EMAIL_FROM` | ⬜ | gửi email OTP (Render chặn SMTP, phải dùng Brevo) |
| `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT_URL` | ⬜ | lưu file gốc lên Cloudflare R2. Không dùng → đặt `OBJECT_STORAGE_PROVIDER=local` |
| `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` | ⬜ | thông tin merchant VNPay |
| `VNPAY_RETURN_URL` | ⬜ | `https://<backend>.onrender.com/api/v1/payments/vnpay/return` |
| `YOUTUBE_PROXY_URL` | ⬜ | proxy lấy transcript YouTube |

Các biến còn lại (`APP_ENV`, `MODEL_NAME`, `USE_DOCLING=false`, `INGEST_ASYNC=false`, `SEED_DEMO=true`...) đã có giá trị trong `render.yaml`.

### Kiểm tra
Mở `https://<backend>.onrender.com/health` → phải thấy `{"status":"ok","env":"production"}`.
Swagger: `https://<backend>.onrender.com/docs`.

> Plan free ngủ sau 15 phút → lần gọi đầu chậm 30–60s. Để giữ ấm: GitHub repo → Settings → Secrets and variables → Actions → **Variables** → thêm `BACKEND_URL = https://<backend>.onrender.com` (workflow `keep-warm.yml` sẽ ping mỗi 10 phút).

---

## 3. Frontend — Vercel

Vercel → **Add New → Project** → import repo:

| Mục | Giá trị |
|-----|---------|
| **Root Directory** | `frontend` ⚠️ (bắt buộc — nếu để root, Vercel sẽ thấy code Python) |
| Framework Preset | Vite |
| Build Command | `npm run build` (mặc định) |
| Output Directory | `dist` (mặc định) |

### Biến môi trường (Settings → Environment Variables, tick cả Production + Preview)

| Biến | Bắt buộc | Giá trị |
|------|:-------:|---------|
| `VITE_API_URL` | ✅ | `https://<backend>.onrender.com` (không có `/` cuối, không có `/api/v1`) |
| `VITE_GOOGLE_CLIENT_ID` | ⬜ | **cùng giá trị** với `GOOGLE_CLIENT_ID` ở backend |

> Biến `VITE_*` được nhúng **lúc build** → sửa biến xong phải **Redeploy** thì mới có hiệu lực.

`frontend/vercel.json` đã rewrite mọi đường dẫn về `index.html` → F5 ở `/student/chat`... không bị 404.

---

## 4. Nối hai bên lại

1. Có URL Vercel (vd. `https://ten-app.vercel.app`) → quay lại Render, đặt `CORS_ORIGINS` và `FRONTEND_URL` = URL đó → Save (Render tự redeploy).
2. **Google OAuth** (nếu dùng): Google Cloud Console → Credentials → OAuth Client → **Authorized JavaScript origins** thêm URL Vercel.
3. **VNPay** (nếu dùng): đăng ký IPN URL `https://<backend>.onrender.com/api/v1/payments/vnpay/ipn` trong trang merchant.

## 5. Kiểm tra cuối

- Mở web Vercel → F12 → Network → đăng nhập. Request phải đi tới `https://<backend>.onrender.com/api/v1/auth/login`.
  - Đi tới `localhost:8000` → chưa đặt `VITE_API_URL` hoặc chưa redeploy Vercel. (Console sẽ báo `[config] Thiếu VITE_API_URL`.)
  - Lỗi **CORS** → `CORS_ORIGINS` sai (thừa `/` cuối, sai `http/https`) hoặc backend chưa redeploy.
- Tài khoản demo (khi `SEED_DEMO=true`): `admin@ai20k.vn / admin123`, `lecturer@ai20k.vn / lecturer123`, `student@ai20k.vn / student123`. Deploy ổn rồi thì đặt `SEED_DEMO=false`.
