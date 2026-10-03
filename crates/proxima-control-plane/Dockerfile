FROM rust:1.98-bookworm AS build
WORKDIR /src
COPY . .
RUN cargo build --release -p proxima-control-plane

FROM debian:bookworm-slim
RUN useradd --system --create-home --uid 10001 proxima
COPY --from=build /src/target/release/proxima-control-plane /usr/local/bin/proxima-control-plane
USER 10001
ENV PROXIMA_CONTROL_BIND=0.0.0.0:8080
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/proxima-control-plane"]
