FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY . .

RUN apt-get update && apt-get install -y openssl \
  && npm install \
  && npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

COPY --from=builder /app .

# Ensure start.sh is executable
RUN chmod +x start.sh

EXPOSE 3000

CMD ["sh", "./start.sh"]
