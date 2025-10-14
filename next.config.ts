import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    typescript: {
        ignoreBuildErrors: true
    },
    productionBrowserSourceMaps: true,
};

export default nextConfig;
