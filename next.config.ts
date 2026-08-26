import type { NextConfig } from "next";
import path from "path";
import packageJson from "./package.json";

const useMapbox = process.env.NEXT_PUBLIC_MAP_TYPE === "mapbox";
const dataVersion = `v${packageJson.version}`;

const nextConfig: NextConfig = {
	reactCompiler: true,
	env: {
		NEXT_PUBLIC_DATA_VERSION: dataVersion,
	},
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
