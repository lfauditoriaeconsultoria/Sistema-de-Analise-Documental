import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'mammoth', 'docx'],
  // Inclui a pasta data/ no bundle das funções serverless do Vercel.
  // Sem isso, fs.readFileSync falha em produção porque os arquivos não são
  // copiados automaticamente para o ambiente de execução.
  experimental: {
    outputFileTracingIncludes: {
      '/api/checklist/generate': ['./data/**/*'],
      '/api/audit/generate':     ['./data/**/*'],
    },
  },
};

export default nextConfig;
