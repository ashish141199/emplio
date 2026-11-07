#!/usr/bin/env bash
# Installs Emplio, or updates it when run again (your .env and data stay):
#   curl -fsSL https://emplio.app/install.sh | bash
# Set EMPLIO_DIR to install somewhere other than ~/emplio.
set -euo pipefail

# everything's in here, so a download cut off halfway runs nothing
main() {
  local dir="${EMPLIO_DIR:-$HOME/emplio}"
  local tarball="${EMPLIO_TARBALL:-https://github.com/emplio-app/emplio/archive/refs/heads/main.tar.gz}"

  if ! command -v docker >/dev/null; then install_docker; fi
  docker compose version >/dev/null 2>&1 || stop "Docker Compose is missing. Update Docker: https://docs.docker.com/get-docker/"

  local setup=("$dir/setup.sh")
  if ! out="$(docker info 2>&1)"; then
    # just added to the docker group: it only counts after logging in again, unless we ask for it
    if command -v sg >/dev/null && sg docker -c "docker info" >/dev/null 2>&1; then
      setup=(sg docker -c "$(printf %q "$dir/setup.sh")")
    else
      case "$out" in
        *"permission denied"*) stop "You don't have access to Docker yet. Run: sudo usermod -aG docker \$USER, log out and back in, then run this again." ;;
        *) stop "Docker isn't running. Start it, then run this again." ;;
      esac
    fi
  fi

  echo "Downloading Emplio to $dir..."
  mkdir -p "$dir"
  curl -fsSL "$tarball" | tar -xz --strip-components=1 -C "$dir"

  # this script arrives through a pipe, so questions have to be asked on the terminal itself
  if : </dev/tty 2>/dev/null; then exec "${setup[@]}" </dev/tty; else exec "${setup[@]}"; fi
}

stop() {
  echo "$1" >&2
  exit 1
}

install_docker() {
  [ "$(uname -s)" = Linux ] && ! grep -qi microsoft /proc/version 2>/dev/null ||
    stop "Emplio needs Docker. Install Docker Desktop and start it, then run this again: https://docs.docker.com/desktop/"
  local answer=""
  if : </dev/tty 2>/dev/null; then read -r -p "Emplio needs Docker. Install it now? [Y/n] " answer </dev/tty; fi
  case "$answer" in [nN]*) stop "Install Docker, then run this again: https://docs.docker.com/get-docker/" ;; esac
  local sudo=""
  [ "$(id -u)" = 0 ] || sudo="sudo"
  echo "Installing Docker. This takes a minute or two..."
  local log
  log="$(mktemp)"
  curl -fsSL https://get.docker.com | $sudo sh >"$log" 2>&1 || { tail -n 15 "$log" >&2; stop "Docker couldn't be installed. Everything it printed is in $log"; }
  [ -z "$sudo" ] || sudo usermod -aG docker "$USER"
  echo "✓ Docker installed"
}

main
