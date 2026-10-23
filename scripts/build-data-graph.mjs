const apiCommands = {
	"atlas-pages": [
		"exec",
		"tsx",
		"--max-old-space-size=3072",
		"scripts/build-atlas-pages.ts",
	],
	"atlas-lookups": [
		"exec",
		"tsx",
		"--max-old-space-size=3072",
		"scripts/build-atlas-lookups.ts",
	],
	"crosswalk-inventory": [
		"exec",
		"tsx",
		"--max-old-space-size=4096",
		"scripts/build-crosswalk-inventory.ts",
	],
	"geometry-store": [
		"exec",
		"tsx",
		"--max-old-space-size=3072",
		"scripts/build-geometry-store.ts",
	],
	"map-resource": [
		"exec",
		"tsx",
		"--max-old-space-size=3072",
		"scripts/build-map-resource.ts",
	],
	documents: [
		"exec",
		"tsx",
		"--max-old-space-size=3072",
		"scripts/build-evidence-documents.ts",
	],
};

const stage = (
	name,
	dependencies = [],
	args = apiCommands[name] ?? ["exec", "tsx", `scripts/build-${name}.ts`],
	{
		cacheable = true,
		outputs = [],
		requiredOutputs = [],
		codeInputs = [],
	} = {},
) => ({
	name,
	dependencies,
	args,
	cacheable,
	outputs,
	requiredOutputs,
	codeInputs,
});

const apiStages = [
	// Always runs. It is quick when data/ already matches the pinned release.
	stage("sources", [], ["--dir", "../..", "data:download"], {
		cacheable: false,
	}),
	stage("operations"),
	stage("query-rules", [], undefined, { cacheable: false }),
	stage(
		"catalogue-registry",
		["sources"],
		[
			"--dir",
			"../..",
			"exec",
			"tsx",
			"scripts/generate-dataset-registry.ts",
			"--catalogue-only",
		],
		{ cacheable: false },
	),
	// Compiled once into data/build/datasets, for the website and the API.
	stage(
		"datasets",
		["catalogue-registry"],
		[
			"--dir",
			"../..",
			"exec",
			"tsx",
			"--max-old-space-size=3072",
			"scripts/compile-datasets.mts",
		],
		{
			outputs: ["data/build/datasets"],
			codeInputs: ["scripts/precompile"],
		},
	),
	stage("terrain-catalogue"),
	stage(
		"atlas-sqlite",
		[
			"terrain-catalogue",
			"datasets",
			"area-inventory",
			"crosswalk-inventory",
			"named-locations",
			"location-projections",
		],
		undefined,
		{ requiredOutputs: ["data/build/atlas.sqlite"] },
	),
	stage(
		"api-datasets",
		["sources"],
		[
			"--dir",
			"../..",
			"exec",
			"tsx",
			"--max-old-space-size=3072",
			"scripts/build-api-datasets.mts",
		],
	),
	stage("boundary-registry", ["sources"]),
	stage("derived-boundaries", ["sources"]),
	stage("area-inventory", ["boundary-registry", "derived-boundaries"]),
	stage("geometry-source-registry", ["area-inventory"]),
	stage("geometry-store", ["geometry-source-registry"], undefined, {
		codeInputs: [
			"services/api/src",
			"services/api/scripts/compileGeometryValidity.ts",
		],
	}),
	stage("named-locations", [
		"area-inventory",
		"geometry-store",
		"api-datasets",
	]),
	stage("place-index", [
		"geography-catalogues",
		"atlas-sqlite",
		"boundary-registry",
		"area-inventory",
		"named-locations",
	]),
	stage("area-search-index", ["atlas-sqlite"]),
	stage("postcode-index", ["sources", "atlas-sqlite"]),
	stage("data-catalog", ["atlas-sqlite"]),
	stage("measure-compatibility", [
		"data-catalog",
		"boundary-registry",
		"area-inventory",
	]),
	stage("export-manifest", ["data-catalog"]),
	stage("postcode-areas", [
		"geography-catalogues",
		"atlas-sqlite",
		"postcode-index",
		"area-inventory",
		"geometry-store",
		"measure-compatibility",
	]),
	stage("postcode-counts", ["postcode-index", "postcode-areas"]),
	stage("crosswalk-inventory", [
		"area-inventory",
		"geometry-source-registry",
	]),
	stage("relationship-paths", ["crosswalk-inventory"]),
	stage("analysis-geographies", [
		"data-catalog",
		"crosswalk-inventory",
		"relationship-paths",
	]),
	stage("analysis-geography-validation", [
		"analysis-geographies",
		"data-catalog",
		"crosswalk-inventory",
	]),
	stage("geography-catalogues", [
		"atlas-sqlite",
		"boundary-registry",
		"geography-inventory",
		"relationship-paths",
		"analysis-geographies",
		"analysis-geography-validation",
	]),
	stage("location-projections", [
		"named-locations",
		"crosswalk-inventory",
		"area-inventory",
	]),
	stage("relationship-candidates", ["area-inventory", "crosswalk-inventory"]),
	stage("geography-inventory", [
		"sources",
		"boundary-registry",
		"area-inventory",
		"crosswalk-inventory",
	]),
	stage("lookup-manifest", [
		"area-inventory",
		"crosswalk-inventory",
		"named-locations",
	]),
	stage(
		"map-resource",
		["boundary-registry", "area-inventory", "geometry-source-registry"],
		undefined,
		{
			outputs: ["data/build/map-resources"],
			codeInputs: [
				"services/api/src/mapResource",
				"services/api/scripts/compileGeometryValidity.ts",
			],
		},
	),
	stage("validation-report", [
		"boundary-registry",
		"area-inventory",
		"geometry-source-registry",
		"crosswalk-inventory",
		"relationship-candidates",
		"geography-inventory",
		"data-catalog",
		"export-manifest",
	]),
	stage(
		"atlas-release-initial",
		[
			"geography-catalogues",
			"atlas-sqlite",
			"boundary-registry",
			"derived-boundaries",
			"area-inventory",
			"named-locations",
			"place-index",
			"area-search-index",
			"postcode-index",
			"postcode-areas",
			"postcode-counts",
			"location-projections",
			"data-catalog",
			"measure-compatibility",
			"export-manifest",
			"lookup-manifest",
			"map-resource",
			"geometry-source-registry",
			"crosswalk-inventory",
			"analysis-geographies",
			"analysis-geography-validation",
			"relationship-paths",
			"relationship-candidates",
			"geography-inventory",
			"validation-report",
			"terrain-catalogue",
		],
		["exec", "tsx", "scripts/build-atlas-release.ts"],
	),
	stage("documents", [
		"atlas-sqlite",
		"atlas-release-initial",
		"operations",
		"geometry-store",
	]),
	stage("atlas-lookups", [
		"geography-catalogues",
		"atlas-sqlite",
		"area-inventory",
		"crosswalk-inventory",
		"relationship-paths",
	]),
	stage("atlas-release", [
		"atlas-release-initial",
		"documents",
		"atlas-lookups",
	]),
	// Place pages read areas, crosswalks, geometry and named locations; the
	// docs catalogue reads the API's catalogue and map resource manifests.
	stage("atlas-pages", [
		"geography-catalogues",
		"api-datasets",
		"boundary-registry",
		"geometry-store",
		"named-locations",
		"location-projections",
		"relationship-paths",
		"data-catalog",
		"export-manifest",
		"geography-inventory",
		"map-resource",
	]),
];

// The website's own data: it copies the API's lookups and pages from disk,
// and the compiled datasets, then builds its boundaries and chunks against
// them. The API reads none of it.
const websiteStages = [
	stage(
		"boundaries",
		["sources"],
		["--dir", "../..", "exec", "tsx", "scripts/compile-boundaries.mts"],
		{ outputs: ["public/data/boundaries"] },
	),
	stage(
		"boundary-tiles",
		["boundaries"],
		[
			"--dir",
			"../..",
			"exec",
			"tsx",
			"--max-old-space-size=3072",
			"scripts/compile-boundary-tiles.mts",
		],
		{ outputs: ["data/build/boundaries", "public/data/boundaries"] },
	),
	stage(
		"website-sources",
		["catalogue-registry"],
		[
			"--dir",
			"../..",
			"exec",
			"tsx",
			"scripts/generate-sources-readme.mts",
		],
		{ cacheable: false },
	),
	stage(
		"website-lookups",
		["atlas-lookups", "atlas-pages"],
		["--dir", "../..", "exec", "tsx", "scripts/copy-atlas-data.mts"],
	),
	stage(
		"website-datasets",
		[
			"atlas-sqlite",
			"website-lookups",
			"website-sources",
			"boundary-tiles",
		],
		[
			"--dir",
			"../..",
			"exec",
			"tsx",
			"--max-old-space-size=3072",
			"scripts/compile-website-data.mts",
		],
		// It keeps unchanged files from its last run. The lookups and pages in
		// public/data belong to website-lookups.
		{
			outputs: ["public/data/datasets", "public/data/precompiled"],
			codeInputs: ["scripts"],
		},
	),
	stage(
		"website-registry",
		["website-datasets"],
		[
			"--dir",
			"../..",
			"exec",
			"tsx",
			"scripts/generate-dataset-registry.ts",
		],
		{ cacheable: false },
	),
	stage(
		"seo",
		["website-registry"],
		["--dir", "../..", "exec", "tsx", "scripts/build-seo-data.mts"],
	),
];

export const buildDataStages = [...apiStages, ...websiteStages];
