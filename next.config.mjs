/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // jsdom (via isomorphic-dompurify) trae una sub-dependencia (html-encoding-
    // sniffer -> @exodus/bytes) que se distribuye como ESM puro. Cuando Next
    // empaqueta una ruta API en un unico archivo para la funcion serverless,
    // el `require()` de esa sub-dependencia falla con ERR_REQUIRE_ESM apenas
    // se carga el modulo — antes de que el codigo de la ruta llegue a
    // ejecutarse. Marcarlo como paquete externo hace que Node lo resuelva con
    // su propia resolucion de modulos (respeta el `exports`/ESM real del
    // paquete) en vez de que el bundler lo fuerce a CommonJS.
    serverComponentsExternalPackages: ['jsdom', 'isomorphic-dompurify'],
  },
};

export default nextConfig;
