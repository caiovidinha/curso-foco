import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `sharp` é binário nativo: precisa ficar fora do bundle do servidor.
  serverExternalPackages: ["sharp"],
  experimental: {
    serverActions: {
      // fotos de cartão-resposta trafegam nas server actions da revisão
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
