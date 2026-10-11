FROM rust:1.98-bookworm AS builder

WORKDIR /app
COPY . .
RUN cargo build --release --locked -p proxima-engine

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --uid 10001 proxima
COPY --from=builder /app/target/release/proxima-engine /usr/local/bin/proxima-engine

USER proxima
EXPOSE 6432

ENV PROXIMA_LISTEN_ADDR=0.0.0.0:6432
ENV PROXIMA_UPSTREAM_ADDR=host.docker.internal:5432

ENTRYPOINT ["/usr/local/bin/proxima-engine"]
