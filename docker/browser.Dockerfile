# One browser. Emplio connects to it over the person's own private network.
FROM debian:bookworm-slim
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends chromium socat ca-certificates fonts-liberation fonts-noto-core fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*
RUN useradd -m browser && mkdir -p /downloads /profile/Default \
    && echo '{"download":{"default_directory":"/downloads","prompt_for_download":false}}' > /profile/Default/Preferences \
    && chown -R browser /downloads /profile
COPY docker/browser-start.sh /browser-start.sh
USER browser
CMD ["bash", "/browser-start.sh"]
