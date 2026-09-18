FROM python:3.13-slim AS build
WORKDIR /app
COPY build.py build_map.py check_build.py ./
COPY content/essay.md ./content/essay.md
COPY short-version.json argument-map.json map.template.html overview.template.html ./
COPY styles.css reading.js argument-map.css argument-map.js argument-overview.css argument-overview.js ./
RUN python build.py --base-path / && python check_build.py

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/public /srv
ENV PORT=8080
EXPOSE 8080
