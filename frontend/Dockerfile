# ---- Stage 1: Build SPA (Vite) ----
FROM node:20-alpine AS builder

WORKDIR /app

# URL backend được nhúng lúc build (Vite chỉ đọc VITE_* khi build).
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci || npm install

COPY . .
RUN npm run build

# ---- Stage 2: Serve tĩnh bằng nginx ----
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
