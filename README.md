# Transmission Web

[![CI](https://github.com/james-gonzalez/transmission-web/actions/workflows/ci.yml/badge.svg)](https://github.com/james-gonzalez/transmission-web/actions/workflows/ci.yml)
[![Release](https://github.com/james-gonzalez/transmission-web/actions/workflows/release.yml/badge.svg)](https://github.com/james-gonzalez/transmission-web/actions/workflows/release.yml)
[![License](https://img.shields.io/github/license/james-gonzalez/transmission-web)](LICENSE)

A modern, lightweight web interface for the Transmission BitTorrent daemon. A Go
backend talks to Transmission over RPC and serves a React single-page app that is
compiled into the binary, so deployment is one file with no external assets.

## Features

- **Live dashboard** — torrent state, progress, speeds and ETA stream to the browser over Server-Sent Events, pushed once per second with no polling or page reloads
- **Torrent management** — add by magnet link or `.torrent` upload, start, stop, remove (with or without data), and force a tracker reannounce
- **Bulk actions** — select multiple torrents and start, stop, reannounce or remove them in one step
- **Filter, sort and paginate** — narrow by status or name and sort by any column; large torrent lists are paginated
- **Detail panels** — per-torrent peers (IP, client, flags, rates), trackers, and a file list where individual files can be deselected mid-download
- **Seed ratio control** — set a ratio limit per torrent or change the global default
- **RSS auto-download** — subscribe to feeds, match items with a regular expression, and have matches added to Transmission automatically. Each feed has its own check interval, a match history and a per-check log for debugging patterns
- **Global statistics** — session and cumulative transfer totals, ratios, disk space and listening-port status
- **Dark theme**, keyboard accessible, responsive down to mobile widths

## Installation

The container image is the fastest path; binaries and source builds are below.

### Docker Compose

Download [`docker-compose.yml`](docker-compose.yml) and
[`.env.example`](.env.example), then:

```bash
cp .env.example .env
# Edit .env: point TRANSMISSION_URL at your daemon and set the password
docker compose up -d
```

Open <http://localhost:8080>.

### Docker

```bash
docker run -d \
  --name transmission-web \
  --restart unless-stopped \
  -p 8080:8080 \
  -v transmission-web-data:/data \
  -e TRANSMISSION_URL="http://transmission.example.com:9091/transmission/rpc" \
  -e TRANSMISSION_USER="transmission" \
  -e TRANSMISSION_PASS="your-password" \
  ghcr.io/james-gonzalez/transmission-web:latest
```

The `-v` mount matters: the RSS feed database lives in `/data` and is lost on
container recreation without it. The container runs as UID/GID 1000.

### Binary Releases

Download the latest build for your platform from the
[releases page](https://github.com/james-gonzalez/transmission-web/releases).

```bash
# Linux AMD64
wget https://github.com/james-gonzalez/transmission-web/releases/latest/download/transmission-web_Linux_x86_64.tar.gz
tar -xzf transmission-web_Linux_x86_64.tar.gz
chmod +x transmission-web
```

### Build from Source

Requires Go 1.25+ and Node.js 20+. The frontend must be built first, because the
Go binary embeds `frontend/dist`:

```bash
git clone https://github.com/james-gonzalez/transmission-web.git
cd transmission-web
cd frontend && npm ci && npm run build && cd ..
go build -o transmission-web .
```

### Kubernetes

Manifests are in [`k8s/`](k8s/). They are a starting point, not a drop-in: edit
the hostname in `httproute.yaml`, the `storageClassName` in `pvc.yaml`, and
create the secret as described in `secret.yaml.template` before applying.

## Configuration

Configure via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `TRANSMISSION_URL` | Transmission RPC endpoint | `http://localhost:9091/transmission/rpc` |
| `TRANSMISSION_USER` | Transmission username | `transmission` |
| `TRANSMISSION_PASS` | Transmission password | _(empty)_ |
| `LISTEN_ADDR` | Web server listen address | `:8080` |
| `DB_PATH` | SQLite file for RSS feeds and download history | `./feeds.db` (`/data/feeds.db` in Docker) |

### Example

```bash
export TRANSMISSION_URL="http://localhost:9091/transmission/rpc"
export TRANSMISSION_USER="transmission"
export TRANSMISSION_PASS="your-password"
export LISTEN_ADDR=":8080"
./transmission-web
```

## Security

**This application has no authentication of its own.** Anyone who can reach
`LISTEN_ADDR` gets full control of your Transmission daemon, including adding and
removing torrents and deleting downloaded data. It is built to run on a trusted
network.

Do not expose it directly to the internet. If you need remote access, put it
behind a reverse proxy that enforces authentication, or reach it over a VPN. To
restrict it to the local machine, bind the loopback interface with
`LISTEN_ADDR="127.0.0.1:8080"`.

## Usage

Open the UI and it connects to Transmission using the configured RPC settings.
The indicator in the header shows the live connection state.

- **Add torrents** — paste a magnet link or upload a `.torrent` file
- **Manage** — start, stop, reannounce or remove a torrent; select several to act on them at once
- **Inspect** — expand a torrent for its peers, trackers and file list
- **RSS** — add a feed with a regex pattern; matching items are added to Transmission automatically on each check. Use the feed's log to see what a pattern matched and why

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development setup, including
running the Vite dev server against the Go backend for frontend work.

```bash
cd frontend && npm ci && npm run build && cd ..
go run .
```

Linting:

```bash
golangci-lint run
cd frontend && npm run lint
```

## Deployment

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
Environment="LISTEN_ADDR=:8080"
Environment="DB_PATH=/var/lib/transmission-web/feeds.db"
EnvironmentFile=/etc/transmission-web/env
ExecStart=/usr/local/bin/transmission-web
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Keep `TRANSMISSION_PASS` in the `EnvironmentFile` (readable only by the service
user) rather than inline, so it does not appear in `systemctl show` output.

## License

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Acknowledgments

- Built with [Go](https://golang.org/)
- Interfaces with [Transmission](https://transmissionbt.com/) BitTorrent daemon
- Inspired by the need for a modern, lightweight transmission web interface
