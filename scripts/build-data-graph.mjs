const stage = (
	name,
	dependencies = [],
	args = [`build:${name}`],
	{ cacheable = true, outputs = [] } = {},
) => ({
	name,
	dependencies,
	args,
	cacheable,
	outputs,
});

const apiStages = [
	// Always runs. It is quick when data/ already matches the pinned release.
	stage("download", [], ["--dir", "../..", "data:download"], {
		cacheable: false,
	}),
	stage("operations"),
	// Compiled once into compiled/datasets, for the website and the API.
	stage("datasets", ["download"], ["--dir", "../..", "datasets:compile"], {
		outputs: ["compiled/datasets"],
	}),
	stage("terrain-catalogue"),
	stage("atlas-sqlite", [
		"terrain-catalogue",
		"datasets",
		"area-inventory",
		"crosswalk-inventory",
		"named-locations",
	]),
	stage("api-datasets", ["download"], ["build:datasets"]),
	stage("boundary-registry", ["download"]),
	stage("derived-boundaries", ["download"]),
	stage("area-inventory", ["boundary-registry", "derived-boundaries"]),
	stage("geometry-source-registry", ["area-inventory"]),
	stage("geometry-store", ["geometry-source-registry"]),
	stage("named-locations", [
		"area-inventory",
		"geometry-store",
		"api-datasets",
	]),
	stage("place-index", [
		"atlas-sqlite",
		"boundary-registry",
		"area-inventory",
		"named-locations",
	]),
	stage("area-search-index", ["atlas-sqlite"]),
	stage("postcode-index", ["download"]),
	stage("data-catalog", ["atlas-sqlite"]),
	stage("measure-compatibility", [
		"data-catalog",
		"boundary-registry",
		"area-inventory",
	]),
	stage("export-manifest", ["data-catalog"]),
	stage("postcode-areas", [
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
	stage("location-projections", [
		"named-locations",
		"crosswalk-inventory",
		"area-inventory",
	]),
	stage("relationship-candidates", ["area-inventory", "crosswalk-inventory"]),
	stage("geography-inventory", [
		"download",
		"boundary-registry",
		"area-inventory",
		"crosswalk-inventory",
	]),
	stage("lookup-manifest", [
		"area-inventory",
		"crosswalk-inventory",
		"named-locations",
	]),
	stage("map-resource", [
		"boundary-registry",
		"area-inventory",
		"geometry-source-registry",
	]),
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
		["build:atlas-release"],
	),
	stage("documents", [
		"atlas-sqlite",
		"atlas-release-initial",
		"operations",
		"geometry-store",
	]),
	stage("atlas-lookups", [
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
		"website-lookups",
		["atlas-lookups", "atlas-pages"],
		["--dir", "../..", "atlas-data:copy"],
	),
	stage(
		"website-datasets",
		["atlas-sqlite", "website-lookups"],
		["--dir", "../..", "precompile:generate"],
		// It keeps unchanged files from its last run. The lookups and pages in
		// public/data belong to website-lookups.
		{ outputs: ["public/data"] },
	),
];

export const buildDataStages = [...apiStages, ...websiteStages];

/**
 * The final stages each product reads. A target builds them and everything
 * they depend on, and nothing else, so building one target and then the other
 * gives the same output as building both.
 */
export const buildDataTargets = {
	api: apiStages.map(({ name }) => name),
	website: ["website-datasets"],
};
