# Build stage
FROM golang:1.25-alpine AS builder

WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o transmission-web .

# Runtime stage
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app
COPY --from=builder /app/transmission-web .

EXPOSE 8080

ENV TRANSMISSION_URL="http://192.168.86.61:9091/transmission/rpc"
ENV TRANSMISSION_USER="transmission"
ENV TRANSMISSION_PASS=""
ENV LISTEN_ADDR=":8080"

CMD ["./transmission-web"]
