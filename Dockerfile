# hiconsy 데모 이미지: API(NestJS) + 화면(Vue 빌드)을 한 서버에서 서빙한다.
# 로컬 확인:  docker build -t hiconsy . && docker run --rm -p 3000:10000 -e JWT_SECRET=<32자 이상 무작위 값> hiconsy  → http://localhost:3000
# (NODE_ENV=production 이라 JWT_SECRET 이 없으면 시작하지 않는다)

# ── 1단계: 빌드 ──
FROM node:24-bookworm-slim AS build
WORKDIR /app
# better-sqlite3 미리 빌드된 바이너리가 없을 때를 대비한 네이티브 빌드 도구
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

# 의존성 먼저 (소스만 바뀌면 이 층은 캐시 재사용)
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci

COPY . .
# 데모 빌드: 디버그 패널 노출 + 기본 연구실 IP 가정
ENV VITE_DEMO=true
RUN npm run build && npm prune --omit=dev

# ── 2단계: 실행 (빌드 도구·소스 없이 결과물만) ──
FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=10000 \
    STATIC_DIR=/app/frontend/dist \
    DATABASE_PATH=/app/backend/data/hiconsy.sqlite

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
# backend 는 통째로 (워크스페이스에 따라 backend/node_modules 가 있을 수도 없을 수도 있어서)
COPY --from=build /app/backend ./backend
COPY --from=build /app/frontend/dist ./frontend/dist

# SQLite 파일 자리. Render 무료 플랜은 디스크가 일시적이라 재시작하면 시드 상태로 돌아간다
RUN mkdir -p /app/backend/data && chown -R node:node /app/backend/data
USER node
EXPOSE 10000
CMD ["node", "backend/dist/main.js"]
