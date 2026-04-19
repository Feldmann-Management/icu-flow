/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/queue", "@workspace/db", "@workspace/github"],
  serverExternalPackages: ["pg-boss", "postgres", "drizzle-orm"],
  output: "standalone",
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
  experimental: {
    swcPlugins: [["@lingui/swc-plugin", {}]],
  },
};

export default nextConfig;
