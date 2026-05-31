#!/bin/sh
# Ensure the content directory is writable by the nextjs user (UID 1001).
# This is needed when ./content is bind-mounted from the host.

# Fix ownership of content directory so the app can save config
if [ -d /app/content ]; then
  chown -R nextjs:nodejs /app/content 2>/dev/null || true
fi

# Drop privileges and run the app as nextjs
exec su-exec nextjs node server.js
