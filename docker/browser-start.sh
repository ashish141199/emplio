#!/bin/bash
# Chromium only listens on its own address, so socat passes the debugging port on to the private network.
# --no-sandbox: the container is the sandbox here, and Chromium's own needs permissions we don't give it.
socat TCP-LISTEN:9222,fork,reuseaddr TCP:127.0.0.1:9223 &
exec chromium --headless=new --no-sandbox --disable-gpu --no-first-run --no-default-browser-check \
  --user-data-dir=/profile --remote-debugging-port=9223 --remote-allow-origins='*' --window-size=1280,1400 about:blank
