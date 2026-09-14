import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['pdfkit'],
  // Ensure Vercel output tracing includes all pdfkit runtime assets
  // (standard font .cjs chunks resolved via package #imports map at runtime)
  outputFileTracingIncludes: {
    '/api/admin/results/[id]/pdf': [
      './node_modules/pdfkit/js/**/*.cjs',
      './node_modules/pdfkit/js/**/*.js',
      './node_modules/pdfkit/js/**/*.mjs',
    ],
    '/api/admin/results/export-pdf': [
      './node_modules/pdfkit/js/**/*.cjs',
      './node_modules/pdfkit/js/**/*.js',
      './node_modules/pdfkit/js/**/*.mjs',
    ],
  },
};

export default nextConfig;
