import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    typescript: {
        ignoreBuildErrors: true
    },
    productionBrowserSourceMaps: true,
    reactCompiler: true
};

export default nextConfig;
