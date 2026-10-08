import type { NextConfig } from "next";
import packageJson from "./package.json";

// Pick the map renderer at build time. The value is inlined into the client
// bundle, so the provider not chosen is never shipped (see
// lib/hooks/useMapInitialization.ts).
const mapProvider = process.env.NEXT_PUBLIC_MAP_PROVIDER || "maplibre";
if (mapProvider !== "maplibre" && mapProvider !== "mapbox") {
	throw new Error(
		`NEXT_PUBLIC_MAP_PROVIDER must be "maplibre" or "mapbox", got "${mapProvider}"`,
	);
}
if (mapProvider === "mapbox" && !process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
	throw new Error(
		"NEXT_PUBLIC_MAP_PROVIDER=mapbox needs NEXT_PUBLIC_MAPBOX_TOKEN",
	);
}
const dataVersion =
	process.env.VERCEL_GIT_COMMIT_SHA ?? `v${packageJson.version}`;

const nextConfig: NextConfig = {
	reactCompiler: true,
	// Place pages read their profiles from disk while rendering on demand.
	outputFileTracingIncludes: {
		"/places/*": ["./public/data/datasets/places/**/*"],
	},
	env: {
		NEXT_PUBLIC_DATA_VERSION: dataVersion,
		NEXT_PUBLIC_MAP_PROVIDER: mapProvider,
	},
	async redirects() {
		// The datasets page used to live at /sources.
		return [
			{ source: "/sources", destination: "/datasets", permanent: true },
			{
				source: "/boundaries",
				destination: "/geographies",
				permanent: true,
			},
			{
				source: "/docs/v1/data/:path*",
				destination: "/docs/v1/datasets/:path*",
				permanent: true,
			},
		];
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
		return config;
	},
};

export default nextConfig;
