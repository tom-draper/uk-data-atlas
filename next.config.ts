import type { NextConfig } from "next";
import path from "path";

const useMapbox = process.env.NEXT_PUBLIC_MAP_TYPE === "mapbox";

const nextConfig: NextConfig = {
	reactCompiler: true,
	webpack: (config) => {
		config.watchOptions = {
			ignored: ["**/data/**", "**/node_modules/**"],
		};
		if (!useMapbox) {
			config.resolve.alias["mapbox-gl"] = path.resolve(
				process.cwd(),
				"lib/stubs/mapbox-gl.ts",
			);
		}
		return config;
	},
};

export default nextConfig;
