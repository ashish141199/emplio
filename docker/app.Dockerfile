# Emplio itself: the API and the web app, built from this source.
FROM node:22-bookworm-slim
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/* && npm install -g bun@1.3.11
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
# The web app's address for the API is fixed at build time. Unset, it uses the page's own host on port 4000.
ARG NEXT_PUBLIC_API_URL=
RUN cd frontend && if [ -n "$NEXT_PUBLIC_API_URL" ]; then export NEXT_PUBLIC_API_URL; else unset NEXT_PUBLIC_API_URL; fi && bun run build
ENV NODE_ENV=production
EXPOSE 3000 4000
CMD ["bash", "docker/app-start.sh"]
