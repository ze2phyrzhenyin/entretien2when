import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  poweredByHeader: false,
  ...(basePath ? { basePath } : {})
};

export default nextConfig;
