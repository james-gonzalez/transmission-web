# Runtime stage - binaries are pre-built by CI and copied in
FROM alpine:3.23

ARG VERSION=dev
ARG TARGETARCH=amd64

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app
COPY transmission-web-linux-${TARGETARCH} ./transmission-web

# Create directory for database
RUN mkdir -p /data

EXPOSE 8080

ENV TRANSMISSION_URL="http://192.168.86.61:9091/transmission/rpc"
ENV TRANSMISSION_USER="transmission"
ENV TRANSMISSION_PASS=""
ENV LISTEN_ADDR=":8080"
ENV DB_PATH="/data/feeds.db"

CMD ["./transmission-web"]
