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

// Where the browser fetches public/data from. A Vercel git deployment reads it
// from jsDelivr at the deployed commit, which keeps the ~700 MB of data files
// off Vercel's edge request and transfer quotas; jsDelivr serves a GitHub file
// only up to 20 MB, and the largest here is 17 MB. Anywhere else, and with
// DATA_HOST=vercel, the files come from the deployment itself.
const {
	VERCEL_GIT_COMMIT_SHA: commit,
	VERCEL_GIT_REPO_OWNER: owner,
	VERCEL_GIT_REPO_SLUG: repo,
} = process.env;
const dataHost =
	process.env.DATA_HOST ?? (commit && owner && repo ? "jsdelivr" : "vercel");
if (dataHost !== "jsdelivr" && dataHost !== "vercel") {
	throw new Error(
		`DATA_HOST must be "jsdelivr" or "vercel", got "${dataHost}"`,
	);
}
if (dataHost === "jsdelivr" && !(commit && owner && repo)) {
	throw new Error("DATA_HOST=jsdelivr needs a Vercel git deployment");
}
const dataBaseUrl =
	dataHost === "jsdelivr"
		? `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${commit}/public`
		: "";

const nextConfig: NextConfig = {
	reactCompiler: true,
	// Place pages read their profiles from disk while rendering on demand.
	outputFileTracingIncludes: {
		"/places/*": ["./public/data/datasets/places/**/*"],
	},
	env: {
		NEXT_PUBLIC_DATA_VERSION: dataVersion,
		NEXT_PUBLIC_DATA_BASE_URL: dataBaseUrl,
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
