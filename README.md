# Transmission Web

[![CI](https://github.com/james-gonzalez/transmission-web/actions/workflows/ci.yml/badge.svg)](https://github.com/james-gonzalez/transmission-web/actions/workflows/ci.yml)
[![Release](https://github.com/james-gonzalez/transmission-web/actions/workflows/release.yml/badge.svg)](https://github.com/james-gonzalez/transmission-web/actions/workflows/release.yml)
[![License](https://img.shields.io/github/license/james-gonzalez/transmission-web)](LICENSE)

A modern, lightweight web interface for Transmission BitTorrent daemon written in Go.

## Features

- **Real-time Dashboard**: View all torrents with live progress, speeds, and peer information
- **Torrent Management**: Add, start, stop, and remove torrents
- **Peer Information**: Detailed peer connections with IP, client, flags, and transfer rates
- **Global Statistics**: Monitor download/upload speeds, ratios, disk usage, and port status
- **Reannounce**: Force tracker reannounce for individual torrents or all at once
- **Auto-refresh**: AJAX-based updates every 3 seconds without page reload
- **Dark Theme**: Modern, clean interface optimized for readability
- **Lightweight**: Single binary with embedded templates, minimal resource usage

## Installation

### Binary Releases

Download the latest release for your platform from the [releases page](https://github.com/james-gonzalez/transmission-web/releases).

```bash
# Linux AMD64
wget https://github.com/james-gonzalez/transmission-web/releases/latest/download/transmission-web_Linux_x86_64.tar.gz
tar -xzf transmission-web_Linux_x86_64.tar.gz
chmod +x transmission-web
```

### Docker

```bash
docker pull ghcr.io/james-gonzalez/transmission-web:latest

docker run -d \
  --name transmission-web \
  -p 8080:8080 \
  -e TRANSMISSION_URL="http://192.168.86.61:9091/transmission/rpc" \
  -e TRANSMISSION_USER="transmission" \
  -e TRANSMISSION_PASS="your-password" \
  ghcr.io/james-gonzalez/transmission-web:latest
```

### Build from Source

```bash
git clone https://github.com/james-gonzalez/transmission-web.git
cd transmission-web
go build -o transmission-web .
```

## Configuration

Configure via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `TRANSMISSION_URL` | Transmission RPC endpoint | `http://localhost:9091/transmission/rpc` |
| `TRANSMISSION_USER` | Transmission username | `transmission` |
| `TRANSMISSION_PASS` | Transmission password | _(empty)_ |
| `LISTEN_ADDR` | Web server listen address | `:8080` |

### Example

```bash
export TRANSMISSION_URL="http://192.168.86.61:9091/transmission/rpc"
export TRANSMISSION_USER="transmission"
export TRANSMISSION_PASS="your-password"
export LISTEN_ADDR=":8080"
./transmission-web
```

## Usage

1. Start the application with appropriate environment variables
2. Open your browser to `http://localhost:8080`
3. View and manage your torrents through the web interface

### Features Overview

- **Add Torrents**: Use magnet links or upload `.torrent` files
- **Start/Stop**: Control individual torrent state
- **Remove**: Delete torrents with optional data removal
- **Reannounce**: Force tracker updates
- **View Peers**: Click any torrent to see connected peers

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

### Quick Start

```bash
go mod download
go run main.go
```

### Testing

```bash
go test -v ./...
```

### Linting

```bash
golangci-lint run
```

## Deployment

### Incus/LXD Container

```bash
# Build for Linux
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o transmission-web-linux .

# Push to container
incus file push transmission-web-linux transmission-web/usr/local/bin/transmission-web

# Restart service (if using init system)
incus exec transmission-web -- rc-service transmission-web restart
```

### Systemd Service

Create `/etc/systemd/system/transmission-web.service`:

```ini
[Unit]
Description=Transmission Web Interface
After=network.target

[Service]
Type=simple
User=transmission-web
Environment="TRANSMISSION_URL=http://localhost:9091/transmission/rpc"
Environment="TRANSMISSION_USER=transmission"
Environment="TRANSMISSION_PASS=your-password"
Environment="LISTEN_ADDR=:8080"
ExecStart=/usr/local/bin/transmission-web
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## License

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Acknowledgments

- Built with [Go](https://golang.org/)
- Interfaces with [Transmission](https://transmissionbt.com/) BitTorrent daemon
- Inspired by the need for a modern, lightweight transmission web interface
