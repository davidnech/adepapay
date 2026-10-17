# Build the frontend without exposing runtime credentials to the browser.
FROM node:22-bookworm-slim AS frontend
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY index.html vite.config.ts ./
COPY .figma/make/site.json .figma/make/site.json
COPY src ./src
COPY content ./content
COPY scripts ./scripts
COPY public ./public
RUN npm run build

FROM python:3.13-slim-bookworm AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    COOKIE_SECURE=true
WORKDIR /app
COPY requirements.txt ./
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --create-home --uid 10001 adepapay
COPY backend/*.py ./backend/
COPY backend/templates ./backend/templates
COPY content ./content
COPY gunicorn.conf.py ./
COPY --from=frontend /build/dist ./dist
USER adepapay
EXPOSE 10000
CMD ["gunicorn", "--config", "gunicorn.conf.py", "backend.wsgi:app"]
