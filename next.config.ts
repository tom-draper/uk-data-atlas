import type { NextConfig } from "next";
import path from "path";
import packageJson from "./package.json";

const useMapbox = process.env.NEXT_PUBLIC_MAP_TYPE === "mapbox";
const dataVersion =
	process.env.VERCEL_GIT_COMMIT_SHA ?? `v${packageJson.version}`;

const nextConfig: NextConfig = {
	reactCompiler: true,
	env: {
		NEXT_PUBLIC_DATA_VERSION: dataVersion,
	},
	async headers() {
		// Immutable caching is safe only because every data URL carries a
		// version query in production (see lib/helpers/cdn.ts). In development
		// `withCDN` returns the bare path, so the same URL would be pinned to
		// the first copy the browser ever saw — recompiling the data changed
		// nothing on screen until the cache was cleared by hand.
		const cacheControl =
			process.env.NODE_ENV === "production"
				? "public, max-age=31536000, immutable"
				: "no-cache";
		return [
			{
				source: "/data/:path*",
				headers: [{ key: "Cache-Control", value: cacheControl }],
			},
		];
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
