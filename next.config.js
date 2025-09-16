/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "randomuser.me",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
  // Allow local dev CORS for 127.0.0.1 and LAN IPs (e.g., 192.168.0.157)
  allowedDevOrigins: [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://192.168.0.157:3000",
  ],
};

export default config;
