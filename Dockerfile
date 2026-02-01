# Build stage
FROM golang:1.25-alpine AS builder

ARG VERSION=dev

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w -X main.Version=${VERSION}" -o transmission-web .

# Runtime stage
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app
COPY --from=builder /app/transmission-web .

# Create directory for database
RUN mkdir -p /data

EXPOSE 8080

ENV TRANSMISSION_URL="http://192.168.86.61:9091/transmission/rpc"
ENV TRANSMISSION_USER="transmission"
ENV TRANSMISSION_PASS=""
ENV LISTEN_ADDR=":8080"
ENV DB_PATH="/data/feeds.db"

CMD ["./transmission-web"]
