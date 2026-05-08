import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server to accept requests from the LAN IP origin.
  // Without this, Next.js 16 blocks /_next/* dev resources when you browse
  // via http://10.0.0.98:3000 instead of localhost, which prevents client-side
  // hydration — pages render but useEffects (like loadPlans) never fire.
  allowedDevOrigins: ['10.0.0.98'],

  // Bundle docs/ into the serverless function output so /admin/api-docs
  // can read API.md at runtime on Vercel.
  outputFileTracingIncludes: {
    '/admin/api-docs': ['./docs/**/*'],
  },
};

export default nextConfig;
