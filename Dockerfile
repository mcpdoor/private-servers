FROM node:slim

# Install flyctl
COPY --from=flyio/flyctl:latest /flyctl /usr/bin/flyctl

# Set working directory
WORKDIR /app

# Copy all files (including workspace packages)
COPY . .

# Install dependencies
RUN npm install

# Build TypeScript code
RUN npm run build

# Create data directory
RUN mkdir -p /data

# Expose port
EXPOSE 8080

# Create volume
VOLUME /data

# Copy the startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]