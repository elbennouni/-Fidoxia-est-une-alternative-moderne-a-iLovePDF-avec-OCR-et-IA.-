import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "*.loca.lt",
    "*.ngrok.io",
    "*.ngrok-free.app",
  ],
};

export default nextConfig;
