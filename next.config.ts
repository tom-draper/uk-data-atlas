import type { NextConfig } from "next";
import packageJson from "./package.json";

const dataVersion =
	process.env.VERCEL_GIT_COMMIT_SHA ?? `v${packageJson.version}`;

const nextConfig: NextConfig = {
	reactCompiler: true,
	// Server-rendered pages and browser data routes share the compiled database.
	outputFileTracingIncludes: {
		"/places/*": ["./data/build/atlas.sqlite"],
		// Postcode pages read their postcode's row when first rendered.
		"/places/postcodes/[district]/[inward]": ["./data/build/atlas.sqlite"],
		"/data/atlas-pages/*": ["./data/build/atlas.sqlite"],
		"/data/atlas-lookups/*": ["./data/build/atlas.sqlite"],
		"/atlas": ["./data/build/atlas.sqlite"],
		"/atlas/*": ["./data/build/atlas.sqlite"],
		"/data/catalogue/*": ["./data/build/atlas.sqlite"],
	},

	env: {
		NEXT_PUBLIC_DATA_VERSION: dataVersion,
		NEXT_PUBLIC_DATA_BASE_URL: "",
	},
	async redirects() {
		// The datasets page used to live at /sources, and the boundaries page
		// at /geographies.
		return [
			{ source: "/sources", destination: "/datasets", permanent: true },
			{
				source: "/geographies",
				destination: "/boundaries",
				permanent: true,
			},
			// The API's list of geographies is now its list of boundaries.
			{
				source: "/docs/v1/reference/geography/list-geographies",
				destination: "/docs/v1/reference/geography/list-boundaries",
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
				source: "/data/:path((?!(?:catalogue|atlas-pages|atlas-lookups)(?:/|$)).*)",
				headers: [{ key: "Cache-Control", value: cacheControl }],
			},
			{
				source: "/data/boundaries/:family/:release/:hash([a-f0-9]{64}).pmtiles",
				headers: [
					{
						key: "Cache-Control",
						value: "public, max-age=31536000, immutable",
					},
				],
			},
			{
				source: "/data/boundaries/:family/:release/boundaries.pmtiles",
				headers: [
					{
						key: "Cache-Control",
						value: "public, max-age=0, must-revalidate",
					},
				],
			},
			{
				source: "/data/boundaries/tiles.json",
				headers: [{ key: "Cache-Control", value: "no-cache" }],
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
