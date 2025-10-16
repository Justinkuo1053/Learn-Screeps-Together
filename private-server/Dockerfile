FROM --platform=$BUILDPLATFORM node:12-buster

# Avoid EOL debian mirrors issues
RUN sed -i -e 's/deb.debian.org/archive.debian.org/g' -e 's/security.debian.org/archive.debian.org/g' /etc/apt/sources.list \
 && apt-get update && apt-get install -y --no-install-recommends \
    python2 build-essential git ca-certificates curl \
 && ln -sf /usr/bin/python2 /usr/bin/python \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Install Screeps server locally (launcher/backend/etc.)
RUN mkdir -p /opt/screeps-cli && cd /opt/screeps-cli \
 && npm init -y \
 && npm i screeps@^4 --unsafe-perm --no-audit --no-fund

# Create game data dir and install mods there
RUN mkdir -p /screeps && cd /screeps \
 && npm init -y \
 && npm i screepsmod-auth@^2.8.2 screepsmod-admin-utils@^1.35.1 --unsafe-perm --no-audit --no-fund

# Expose @screeps/* packages to mods via symlink
RUN mkdir -p /screeps/node_modules \
 && ln -s /opt/screeps-cli/node_modules/@screeps /screeps/node_modules/@screeps

# Defaults (copied on first run only)
COPY defaults /defaults
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /screeps
VOLUME ["/screeps"]

EXPOSE 21025 21026

ENTRYPOINT ["/entrypoint.sh"]
CMD ["/opt/screeps-cli/node_modules/.bin/screeps", "start"]
