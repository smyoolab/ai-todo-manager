import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Turbopack 루트 디렉토리 명시 (workspace root 경고 해결)
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
