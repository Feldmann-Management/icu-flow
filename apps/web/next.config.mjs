/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui"],
  output: "standalone",
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
  experimental: {
    swcPlugins: [["@lingui/swc-plugin", {}]],
  },
};

export default nextConfig;
