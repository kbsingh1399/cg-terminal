import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* type errors fail the build — non-app dirs (examples/scripts/tests)
     are excluded in tsconfig.json */
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
};

export default nextConfig;
