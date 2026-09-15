const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for the Docker build: bundles a minimal server + deps into .next/standalone.
  output: "standalone",
  experimental: {
    // Trace from the monorepo root so workspace packages (@gooseboard/*) are included.
    outputFileTracingRoot: path.join(__dirname, "../.."),
  },
};

module.exports = nextConfig;
