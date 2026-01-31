# Contributing to Transmission Web

Thank you for your interest in contributing to Transmission Web!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/transmission-web.git`
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test your changes
6. Commit your changes (see commit guidelines below)
7. Push to your fork: `git push origin feature/your-feature-name`
8. Open a Pull Request

## Development Setup

### Prerequisites

- Go 1.21 or later
- Docker (optional, for container testing)

### Building

```bash
go build -o transmission-web .
```

### Running Locally

```bash
export TRANSMISSION_URL="http://localhost:9091/transmission/rpc"
export TRANSMISSION_USER="your-username"
export TRANSMISSION_PASS="your-password"
export LISTEN_ADDR=":8080"
./transmission-web
```

### Running with Docker

```bash
docker build -t transmission-web .
docker run -p 8080:8080 \
  -e TRANSMISSION_URL="http://192.168.86.61:9091/transmission/rpc" \
  -e TRANSMISSION_USER="transmission" \
  -e TRANSMISSION_PASS="your-password" \
  transmission-web
```

## Commit Message Guidelines

This project uses [Semantic Versioning](https://semver.org/) and [Conventional Commits](https://www.conventionalcommits.org/).

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: A new feature (triggers MINOR version bump)
- **fix**: A bug fix (triggers PATCH version bump)
- **docs**: Documentation only changes
- **style**: Changes that don't affect code meaning (formatting, etc.)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Changes to build process or auxiliary tools
- **ci**: Changes to CI configuration files and scripts

### Breaking Changes

Add `BREAKING CHANGE:` in the footer or append `!` after the type/scope to trigger a MAJOR version bump:

```
feat!: redesign API endpoint structure

BREAKING CHANGE: API endpoints have been restructured
```

### Examples

```
feat: add torrent filtering by status
```

```
fix: correct session ID refresh logic
```

```
docs: update installation instructions
```

```
feat!: change RPC client to use context

BREAKING CHANGE: All RPC methods now require context.Context as first parameter
```

## Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Update documentation as needed
- Ensure all CI checks pass
- Write clear, descriptive PR descriptions
- Reference related issues using `Fixes #123` or `Closes #123`

## Code Style

- Run `go fmt` before committing
- Follow [Effective Go](https://golang.org/doc/effective_go) guidelines
- Use meaningful variable and function names
- Add comments for exported functions and complex logic

## Testing

While we don't currently have extensive tests, we welcome contributions that add test coverage:

```bash
go test -v ./...
```

## Questions?

Feel free to open an issue for any questions or discussions!
