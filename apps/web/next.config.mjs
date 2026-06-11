import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep dev and production artifacts separate so `pnpm build` during dev work
  // does not corrupt the running dev server's webpack/CSS chunks.
  distDir: process.env.NODE_ENV === 'production' ? '.next' : '.next-dev',
  // Monorepo: pin tracing root so Next doesn't guess from multiple lockfiles.
  outputFileTracingRoot: repoRoot,
  // Workspace packages export raw TS; let Next transpile them.
  transpilePackages: ['@scp/shared', '@scp/ai'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  // No ESLint config shipped in this take-home; rely on tsc for type safety.
  eslint: { ignoreDuringBuilds: true },
  // Workspace packages use ESM-style ".js" import specifiers that point at ".ts"
  // source. Teach webpack to resolve them (tsx/tsc already do).
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
};

export default nextConfig;
