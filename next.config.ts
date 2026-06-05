import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'mammoth', '@napi-rs/canvas', 'pdfjs-dist', 'docx'],
};

export default nextConfig;
