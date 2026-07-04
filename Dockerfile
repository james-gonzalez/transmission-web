# Build stage - compile per-platform inside buildx using automatic platform ARGs
FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS build

# Provided automatically by buildx for each target platform
ARG TARGETOS
ARG TARGETARCH
ARG VERSION=dev

WORKDIR /src

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Build
COPY . .
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -ldflags="-s -w -X main.Version=${VERSION}" -o /out/transmission-web .

# Runtime stage
FROM alpine:3.24

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app
COPY --from=build /out/transmission-web ./transmission-web

# Create directory for database
RUN mkdir -p /data

EXPOSE 8080

# ENV TRANSMISSION_URL must be supplied at runtime
ENV TRANSMISSION_USER="transmission"
ENV TRANSMISSION_PASS=""
ENV LISTEN_ADDR=":8080"
ENV DB_PATH="/data/feeds.db"

CMD ["./transmission-web"]
