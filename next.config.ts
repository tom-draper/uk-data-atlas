import type { NextConfig } from "next";
import packageJson from "./package.json";
import { LEGACY_DATA_PAGES } from "./lib/docs/legacyDataPages";
import { DATASET_ALIASES } from "./packages/datasets/src/declaration/datasetAliases";

const dataVersion =
	process.env.VERCEL_GIT_COMMIT_SHA ?? `v${packageJson.version}`;

const nextConfig: NextConfig = {
	reactCompiler: true,
	// Server-rendered pages and browser data routes share the compiled database.
	// The website's own pages and lookups are in `website-assets.sqlite`, which
	// is not part of the API's release, so the routes that read them list it.
	outputFileTracingIncludes: {
		"/places/*": [
			"./data/build/atlas.sqlite",
			"./data/build/website-assets.sqlite",
		],
		// Postcode pages read their postcode's row when first rendered.
		"/places/postcodes/[district]/[inward]": [
			"./data/build/atlas.sqlite",
			"./data/build/website-assets.sqlite",
		],
		"/data/atlas-pages/*": ["./data/build/website-assets.sqlite"],
		"/data/atlas-lookups/*": ["./data/build/website-assets.sqlite"],
		"/atlas": ["./data/build/atlas.sqlite"],
		"/atlas/*": ["./data/build/atlas.sqlite"],
		"/data/catalogue/*": ["./data/build/atlas.sqlite"],
		// Measure queries read the statistics rows through the catalogue, the
		// read path that selects each measure's series, and the reviewed
		// mapping of catalogue ids onto measures and dimensions.
		"/data/measures/*": [
			"./data/build/atlas.sqlite",
			"./data/build/artifacts/data-catalog.json",
		],
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
			// The geography reference pages are now the boundary pages.
			{
				source: "/docs/v1/geographies/:path*",
				destination: "/docs/v1/boundaries/:path*",
				permanent: true,
			},
			{
				source: "/docs/v1/geographies",
				destination: "/docs/v1/boundaries",
				permanent: true,
			},
			// The API's list of geographies is now its list of boundaries.
			{
				source: "/docs/v1/reference/geography/list-geographies",
				destination: "/docs/v1/reference/geography/list-boundaries",
				permanent: true,
			},
			// The dataset pages were once under /data, then grouped by hand
			// at /datasets/<slug>. Both go straight to the page that replaced
			// them. The population page is now the population theme, which
			// keeps its own address, so only /data/population moves.
			...Object.entries(LEGACY_DATA_PAGES).flatMap(
				([slug, destination]) => [
					{
						source: `/docs/v1/data/${slug}`,
						destination,
						permanent: true,
					},
					...(slug === "population"
						? []
						: [
								{
									source: `/docs/v1/datasets/${slug}`,
									destination,
									permanent: true,
								},
							]),
				],
			),
			{
				source: "/docs/v1/data/:path*",
				destination: "/docs/v1/datasets/:path*",
				permanent: true,
			},
			// Datasets that were merged keep their old addresses. A merged
			// dataset stays in the topic of the datasets it replaced.
			...Object.entries(DATASET_ALIASES).flatMap(([old, alias]) => [
				{
					source: `/docs/v1/datasets/:theme/:topic/${old}`,
					destination: `/docs/v1/datasets/:theme/:topic/${alias.dataset}`,
					permanent: true,
				},
				{
					source: `/atlas/:location/${old}`,
					destination: `/atlas/:location/${alias.dataset}`,
					permanent: true,
				},
			]),
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
