# AGENTS.md

Go web UI for the Transmission BitTorrent daemon. Single binary with embedded templates + an RSS auto-download feature backed by SQLite.

## Layout (read this before editing)

- The entire backend is **two files in package `main` at the repo root**: `main.go` (HTTP server, Transmission RPC client, handlers) and `rss.go` (feed manager, SQLite). There are no subpackages.
- **The served UI is `templates/index.html`**, embedded via `//go:embed templates/*` in `main.go`. Edit that file to change the web interface.
- **`web/` is an unfinished, decoupled Next.js scaffold** (still named `my-app`, demo credentials, generic shadcn README). It is NOT imported by the Go backend, NOT in CI, NOT built into the binary, and NOT deployed. Do not assume it is the frontend or touch it unless explicitly asked.

## Commands

```bash
go run main.go              # run locally (needs a reachable Transmission RPC)
go build -o transmission-web .
go test -v ./...            # tests are sparse but this is the command
go vet ./...
gofmt -s -l .               # CI fails if this lists ANY file; fix with: gofmt -s -w .
golangci-lint run           # config in .golangci.yml
```

Production/cross builds are CGO-free (SQLite driver is pure-Go `modernc.org/sqlite`):

```bash
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w -X main.Version=$VER" .
```

## Config (env vars)

`TRANSMISSION_URL`, `TRANSMISSION_USER`, `TRANSMISSION_PASS`, `LISTEN_ADDR` (default `:8080`), and **`DB_PATH`** (default `./feeds.db`) for the RSS SQLite file. `DB_PATH` is undocumented in README but real — set it in containers (Dockerfile uses `/data/feeds.db`).

## CI / conventions

- CI (`.github/workflows/ci.yml`) is Go-only: lint (`golangci-lint`, installed `@latest`) → govulncheck → vet + `gofmt -s` check + cross-platform build → docker build. Run `gofmt -s -w .` and `golangci-lint run` before pushing.
- **Conventional Commits are required** — `release.yml` uses semantic-release to version and publish. Use `feat:`/`fix:`/etc.; `feat!:` or `BREAKING CHANGE:` bumps major.
- Releases (`.goreleaser.yaml`) ship `templates/**/*` alongside the binary — keep templates buildable/embeddable.

## Gotchas

- `*.db` is gitignored; the binary recreates `feeds.db` on first run, so a missing DB is normal.
- `k8s/secret.yaml` is gitignored — copy `k8s/secret.yaml.template`. Deploy manifests live in `k8s/`.
