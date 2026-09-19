/**
 * The friendly face of each endpoint: a short title for navigation, a plain
 * introduction, and the things worth knowing before you call it. The precise
 * contract stays in `api/openapi.yaml` and is shown beneath this on every
 * page. Keyed by `operationId`; the docs tests fail if an endpoint is added
 * to the spec without an entry here, or an entry outlives its endpoint.
 *
 * Text may use `code`, **bold** and [links](/docs/v1/...).
 */
export interface EndpointContent {
	title: string;
	intro: string;
	tips?: string[];
}

export const ENDPOINTS: Record<string, EndpointContent> = {
	// Essentials
	getRoot: {
		title: "List every route",
		intro: "Returns the paths the API serves right now. Handy as a quick health check, or to see at a glance what's available.",
	},
	getDocumentation: {
		title: "Open the built-in docs page",
		intro: "A single HTML page the API serves itself, built from the OpenAPI spec: a route chooser, a glossary, three quick starts and every endpoint with the mistake people most often make calling it. Useful wherever the API runs without this site.",
	},
	getOpenapiDescription: {
		title: "Get the OpenAPI spec",
		intro: "Download the machine-readable OpenAPI 3.1 description of the whole API, as YAML. Point a client generator, Postman or your editor at it and you get every route, parameter and response shape for free.",
	},
	resolvePlaces: {
		title: "Search places by name",
		intro: 'Type a place name and get back every area it could mean. Place names are slippery: "Newport" is thirteen different areas across Wales, the Isle of Wight and Shropshire. Rather than guessing, this lists them all so you can choose.',
		tips: [
			"Matching ignores case, accents, punctuation and ampersands, so `Brighton & Hove` and `Ynys Mon` find what was published.",
			'Official titles are set aside too: "Bristol" finds the council published as "Bristol, City of".',
			"Each result has a `place` reference, like `localAuthority/E06000023`, that you can pass straight to [Get a value for a place](/docs/v1/reference/start-here/measure-value-for-place).",
		],
	},
	getMeasureValueForPlace: {
		title: "Get a value for a place",
		intro: 'The quickest way to answer a question like "what was the population of the North West in 2022?". Give a measure and a place name and you get a single number back, with a note of exactly how it was worked out.',
		tips: [
			"Leave out `period` to get the latest one. The answer tells you when it did that, with `periodDefaulted`.",
			"If a name could mean several places with different answers, you'll get a `409` listing the `choices`. Pass one of their `place` references to pick.",
			"Already know the area code? [Get observations](/docs/v1/reference/map/measure-observations) or [Get a time series](/docs/v1/reference/trend/source-exact-measure-series) give you more control.",
		],
	},
	getAreaCapabilities: {
		title: "See what's available for an area",
		intro: "Give it one area and find out everything the Atlas can do with it: whether it has a shape, which relationships and named locations it belongs to, and which measures have data for it.",
	},

	// Maps & spatial
	getMeasureObservations: {
		title: "Get observations",
		intro: "The main way to fetch data. Ask for a measure, a period and the set of areas it was published on, and you get the values exactly as the publisher released them, with nothing converted or added up.",
		tips: [
			"`geography` and `boundaryYear` together choose which published set of area codes you want. [Get a measure](/docs/v1/reference/data-catalogue/measure) lists the combinations on offer.",
			"Add `release` to draw the values on a particular set of boundaries. It's accepted only when every area code is in that release, so your map never silently loses areas.",
			"Set `format=csv` or `format=ndjson` for a table you can load straight into a spreadsheet or database.",
		],
	},
	findAreasIntersectingBox: {
		title: "Find areas in a box",
		intro: "Give a box of coordinates as `west,south,east,north` and get every area that meets it, each marked `within` the box or `overlaps` if it crosses the edge. It's the query a map makes as you pan around.",
		tips: [
			"You get area identities by default, which keeps wide boxes quick. Add `tier` to include their shapes too.",
		],
	},
	findContainingAreas: {
		title: "Find areas at a point",
		intro: "Which ward is this spot in? Give a longitude and latitude and get the area, or areas, of one geography that contain it.",
		tips: [
			"A point exactly on a border belongs to both sides, so you can get more than one result. Those are labelled `boundary`.",
		],
	},
	findContainingAreasForPoints: {
		title: "Find areas for many points",
		intro: "The same lookup as [Find areas at a point](/docs/v1/reference/map/find-containing-areas), for up to 100 points in one request. Handy for tagging a list of sites or addresses with their ward and council.",
		tips: [
			"Give each point as `point={lng},{lat}`, repeated. Add a third number for its accuracy in metres.",
			"Details that are the same for every point, like which boundary release was used, are given once in `releases` rather than repeated per point.",
			"For more than 100 points, send them in batches.",
		],
	},
	findNearestAreas: {
		title: "Find the nearest areas",
		intro: "Get the areas closest to a point, nearest first, with the distance to each. It answers the questions a containment lookup can't, like which ward is nearest a point just offshore.",
		tips: [
			"A distance of zero means the point touches the area, but only [Find areas at a point](/docs/v1/reference/map/find-containing-areas) says an area contains it.",
			"`within` sets how far to look, in metres, and `limit` how many areas to return.",
		],
	},
	getAreaChildrenGeometry: {
		title: "Get the shapes inside an area",
		intro: "Get the shapes of every area inside another, such as all the wards in a local authority, as one GeoJSON FeatureCollection. One request instead of hundreds.",
		tips: [
			"Use `tier=low` or `tier=medium` for web maps. Large authorities have a lot of detail.",
		],
	},
	getAreaNeighbours: {
		title: "List neighbouring areas",
		intro: 'Find the areas that share a border with this one, longest shared border first. Just what you need for "how does this ward compare with the ones around it?".',
		tips: [
			"Set `touches=any` to include areas that only meet at a corner. Their `sharedBorderM` is zero.",
		],
	},
	getAreaOverlap: {
		title: "Measure how two areas overlap",
		intro: "See how much two areas overlap, even across different geographies such as a constituency and a local authority, without downloading either shape. You get the shared area, each side's share of it and a plain relation like `within` or `overlaps`.",
	},
	getAreaGeometry: {
		title: "Get an area's shape",
		intro: "Download one area's boundary as a GeoJSON Feature, in ordinary longitude and latitude (WGS 84). You get full detail by default; add `tier` for a lighter version.",
		tips: [
			"An area made of several pieces, like one with islands, comes back as a single GeometryCollection.",
		],
	},
	getAreaGeometryMetadata: {
		title: "Get an area's size and centre",
		intro: "Get an area's bounding box, centre, a good spot for its label, its area and its perimeter, without downloading the shape itself.",
		tips: [
			"`labelPoint` is always inside the area, even for shapes whose centre falls outside them.",
		],
	},

	// Analysis
	aggregateSourceExactMeasure: {
		title: "Add up a measure",
		intro: "Get a total over a group of areas, such as a country, a combined authority, a county or a named location like Greater Manchester. Shares with a published weight are averaged instead. It only combines values where the result genuinely means something.",
		tips: [
			"Pass exactly one of `locationId`, `areaCode` or `targetCode`.",
			"`targetCode` sums onto whatever geography your chosen `crosswalk` maps to, so the same call gives you a combined authority, a county or a region. Find one with [List crosswalks](/docs/v1/reference/geography/list-crosswalks).",
			"Only a crosswalk that establishes membership can be used. Clean containment and full area overlap qualify; a lookup that relates two vintages of the same area does not, and is refused rather than summed.",
			"Counts add up. Medians and ranks don't, so asking for one gets a `422` that explains why, rather than a misleading number.",
			"If a named location is missing some of its areas, you get a `partial_coverage` refusal. A country or membership total with gaps is still returned, with its coverage stated plainly.",
		],
	},
	convertSourceExactMeasure: {
		title: "Convert to other areas",
		intro: "Regroup a measure onto a different set of areas, such as wards up to local authorities, using a crosswalk you choose. Only counts can be converted, because converting works by adding values up.",
		tips: [
			"Find a crosswalk with [List crosswalks](/docs/v1/reference/geography/list-crosswalks).",
			"The response's `method` tells you whether the conversion was `exact`, meaning every area fitted neatly inside one target.",
		],
	},
	getSourceExactMeasureSeries: {
		title: "Get a time series",
		intro: "Get every value for one area, oldest first. Usually these are published source-exact values; a reviewed analysis geography can instead return values explicitly regrouped onto one named boundary frame.",
		tips: [
			"If a measure has more than one source for that geography, add `datasetId` to choose between them.",
			"Add `analysisGeography=geography/release` only after checking [reviewed conversions](/docs/v1/reference/trend/list-analysis-geographies). Derived entries name their source and conversion; an unsupported frame returns `not-comparable` rather than a guessed substitute.",
		],
	},
	getSourceExactMeasureRankings: {
		title: "Rank areas",
		intro: "Rank every area by a measure for one period: the most populous wards, the lowest emissions and so on. Tied areas share a rank, so you'll see 1, 1, 3.",
		tips: [
			"Highest values come first. Set `order=asc` to start from the lowest.",
		],
	},
	getSourceExactMeasureChange: {
		title: "Rank areas by change",
		intro: "Find where things changed most between two periods, such as where population grew fastest between 2011 and 2022. Add `areaCode` to see one area's change and where it ranks against all the others.",
		tips: [
			"`by=absolute` ranks the plain difference. `by=relative` ranks it as a proportion of the starting value.",
			"Relative change isn't offered for percentages: going from 2% to 4% isn't really \"100% growth\".",
		],
	},
	compareSourceExactMeasureAreas: {
		title: "Compare two areas",
		intro: "Put two areas side by side for one period and get both values and the difference between them.",
	},
	listAnalysisGeographies: {
		title: "List reviewed conversions",
		intro: "See which measure, source and analysis-boundary combinations the Atlas has reviewed as safe to convert. A crosswalk appearing in the catalogue alone is not an approval to use it for analysis.",
		tips: [
			"Add `measure` to narrow the list to the conversions available for one measure.",
			"Each entry names the source partition and the crosswalk, so you can inspect exactly what will be regrouped.",
		],
	},
	planAnalysis: {
		title: "Preflight an analysis conversion",
		intro: "Check whether one published period can be compared on a named analysis boundary before retrieving data. The response is a plan: it selects no data and never silently chooses between source partitions.",
		tips: [
			"Name `sourceGeography` and `sourceBoundaryYear` explicitly, even when a measure has only one obvious source today.",
			"An `available` plan gives you the exact conversion request. A `not-comparable` plan explains why the named period cannot be used on that frame.",
		],
	},
	getMeasureConversionSupport: {
		title: "Check conversion support",
		intro: "Inspect the reviewed conversion paths for one measure on one analysis boundary. Use it to discover supported source partitions before asking for a preflight plan.",
		tips: [
			"`analysisGeography` is one exact `geography/release` pair, for example `localAuthority/2023-05-uk-bgc-v2`.",
			"An unsupported response is intentional: it means the Atlas has not established a defensible path, not that it guessed a substitute.",
		],
	},

	// Bulk data & releases
	getPinnedMapResource: {
		title: "Get a pinned map resource",
		intro: "The same as [Get a map resource](/docs/v1/reference/geography/map-resource), but locked to one Atlas release so it never changes. Use this form in production: it can be cached for good.",
		tips: [
			"Only the release the server currently holds can be served. An older one returns `410 Gone` rather than quietly giving you newer data.",
		],
	},
	listBulkExports: {
		title: "List downloads",
		intro: "See every complete dataset you can download in one go, with its size, how many records it holds and a hash to check it arrived intact.",
	},
	downloadBulkExport: {
		title: "Download a dataset",
		intro: "Download one complete set of observations as a single JSON file. Much easier than paging through thousands of requests when you want everything.",
		tips: [
			"This response isn't wrapped in the usual envelope: it's the file itself.",
		],
	},
	listBulkLookups: {
		title: "List lookup tables",
		intro: "See every lookup table you can download: the area codes and names in each boundary release, crosswalks flattened to one row per mapping, and named-location membership.",
	},
	downloadBulkLookup: {
		title: "Download a lookup table",
		intro: "Download a whole lookup table as CSV or NDJSON, ready to load into a spreadsheet or database.",
		tips: [
			"This response isn't wrapped in the usual envelope: it's the table itself.",
		],
	},
	getAtlasRelease: {
		title: "Get the current release",
		intro: "Every response comes from an Atlas release: a fingerprinted snapshot of all the data behind the API. This returns the current one, including its `releaseId`.",
		tips: [
			"Building from the same inputs always gives the same `releaseId`, so recording it lets you reproduce a result exactly.",
		],
	},
	listAtlasReleases: {
		title: "List releases",
		intro: "List the current Atlas release and the archived ones before it.",
	},
	getArchivedAtlasRelease: {
		title: "Get a release",
		intro: "Get the manifest for one Atlas release, current or archived, by its `releaseId`.",
	},
	compareAtlasReleases: {
		title: "Compare two releases",
		intro: "See what changed between two Atlas releases: the datasets, measures, boundaries, crosswalks and more that were added, removed or changed. Useful for refreshing only what moved.",
		tips: ["Leave out `to` to compare against the current release."],
	},

	// Areas & boundaries
	listMapResources: {
		title: "List map resources",
		intro: "List the boundary releases that are ready to draw as vector tiles. Releases are tiled deliberately, not automatically, so this list is short.",
	},
	getMapResource: {
		title: "Get a map resource",
		intro: "Everything you need to draw one boundary release: the tile and archive URLs, zoom levels, where the shapes came from and the attribution to show beside your map.",
	},
	getMapResourceTileJson: {
		title: "Get TileJSON",
		intro: "The TileJSON 3.0 document you give a map library like MapLibre, including the attribution your map needs to display.",
	},
	getMapResourceTile: {
		title: "Get a vector tile",
		intro: "One Mapbox Vector Tile of boundaries. Each feature carries the area's `code`, its `name` and a numeric `id`. Values aren't baked in, so one set of tiles works for every measure.",
		tips: [
			"A tile with no areas in it is a `204`, which is a normal answer rather than an error.",
			"Colour areas by fetching [values for tiles](/docs/v1/reference/geography/map-resource-join) and joining them on `id`.",
		],
	},
	getMapResourceJoin: {
		title: "Get values for tiles",
		intro: "A small table of one measure's values, keyed by the same numeric `id` the tiles use, so your map can colour areas without touching the shapes.",
		tips: [
			"If the measure's area codes aren't all in this boundary release, you'll get an `incompatible_geometry` refusal that names releases that would work.",
			"Add `format=parquet` for the same table as a Parquet file, to join to the [GeoParquet shapes](/docs/v1/reference/geography/map-resource-features) in a warehouse.",
		],
	},
	getMapResourceFeatures: {
		title: "Download shapes as GeoParquet",
		intro: "Every area of a boundary release in one GeoParquet file, ready for DuckDB, BigQuery, QGIS or GeoPandas. The shapes match the tiles exactly, borders included, and each row carries the same `id` and `code`, so values join straight on.",
		tips: [
			"`tier` is required. Use `full` for analysis, or `medium` or `low` for a lighter file.",
			"A `bbox` column lets your database skip areas outside the region you're querying.",
			"[Get values for tiles](/docs/v1/reference/geography/map-resource-join) with `format=parquet` gives you the matching values table.",
		],
	},
	getMapResourceArchive: {
		title: "Download all tiles",
		intro: "Every tile for a boundary release in a single PMTiles file. Host it on a CDN, or use it offline.",
	},
	listGeographies: {
		title: "List geographies",
		intro: "List the kinds of area the Atlas knows about, such as wards, local authorities and constituencies, each with its latest boundary release.",
	},
	listBoundaryReleases: {
		title: "List boundary releases",
		intro: "List every set of boundaries the Atlas has compiled, across all geographies and dates.",
	},
	resolveBoundaryReleaseForDate: {
		title: "Find boundaries for a date",
		intro: "Which local authority boundaries should you use for June 2023? Give a geography and a date and get an exact boundary release id back, along with the releases just before and after it.",
		tips: ["Add `country` to only consider releases that cover it."],
	},
	getBoundaryRelease: {
		title: "Get a boundary release",
		intro: "Get the details of one boundary release: who published it, under what licence, and which countries it covers.",
	},
	getGeographyInventory: {
		title: "Check geography coverage",
		intro: "For every boundary release, see whether its areas have been compiled and which crosswalks connect it to others, or the reason they haven't yet.",
	},
	listAreas: {
		title: "List or search areas",
		intro: "Browse or search areas by code, name or alias, optionally narrowed to one geography and boundary release.",
		tips: [
			"Exact code matches come first, so searching a code finds that area in every release that holds it.",
		],
	},
	validateAreaValues: {
		title: "Check codes or names",
		intro: "Got a spreadsheet column of area codes or names? Check up to 500 at once against a boundary release before you join data to it. Each comes back as `valid`, `superseded`, `ambiguous` and so on, with the reason.",
		tips: [
			"Repeat `value` once for each code or name, like `value=Bristol&value=E07000026`.",
		],
	},
	getArea: {
		title: "Get an area",
		intro: "Look up one area by its geography, boundary release and code, and get its name and any aliases.",
	},
	getAreaRelationships: {
		title: "Get an area's relationships",
		intro: "See how an area relates to others through published crosswalks: what it sits `within`, what it `contains`, what it replaced or was replaced by, and what it `overlaps`.",
	},
	getAreaHistory: {
		title: "Get an area's history",
		intro: "Trace an area through time: what it replaced, what replaced it, and which other boundary releases use the same code.",
		tips: [
			"The same code in two releases doesn't guarantee the same boundary, so treat it as a clue, not proof.",
		],
	},
	getAreaParents: {
		title: "List parent areas",
		intro: "List the published areas this one sits wholly inside.",
	},
	getAreaChildren: {
		title: "List child areas",
		intro: "List the published areas that sit wholly inside this one, like the wards in a local authority.",
	},
	listCrosswalks: {
		title: "List crosswalks",
		intro: "A crosswalk maps one set of areas onto another, such as wards to local authorities, or 2010 constituencies to 2024 ones. This lists every crosswalk the Atlas publishes.",
	},
	getCrosswalk: {
		title: "Get a crosswalk",
		intro: "Find out how a crosswalk was made and how reliable it is, without downloading its full list of mappings.",
	},
	listCrosswalkRecords: {
		title: "List crosswalk mappings",
		intro: "Page through a crosswalk's mappings, or filter them to one `source` area.",
	},
	findRelationshipPaths: {
		title: "Check how two releases connect",
		intro: "Before translating codes between two boundary releases, check whether the Atlas publishes a way to do it, and how. You get each path step by step, with the method behind it, or a clear reason why there isn't one.",
		tips: [
			"`purpose` matters: `identity` for old codes to new, `membership` for what sits inside what, and `apportion` for areas that overlap.",
			"If nothing is published for your purpose but something is for another, `alternatives` points you to it.",
		],
	},
	translateAreaCode: {
		title: "Translate an area code",
		intro: "Turn a code in one geography into its match in another: a ward into its local authority, or an old constituency into its 2024 successor.",
		tips: [
			"Use `purpose` to say what you need: `identity` for old codes to new, `membership` for what sits inside what, and `apportion` for areas that overlap.",
		],
	},
	listNamedLocations: {
		title: "List named locations",
		intro: 'Named locations are handy groupings the official geographies don\'t have, like "North Wales" or "Greater Manchester". Search them by name with `q`.',
		tips: [
			"They're curated by the Atlas for convenience. They aren't official administrative areas.",
		],
	},
	getNamedLocation: {
		title: "Get a named location",
		intro: "Get one named location's description, the area codes it's made from and its bounds.",
	},
	getNamedLocationParents: {
		title: "Find what a named location sits in",
		intro: "The other way round from listing its areas: which regions, counties or combined authorities a named location falls in, and whether it covers each one whole or only part of it.",
		tips: [
			"Give `geography` and `release`, then choose a crosswalk with `via`. Leave `via` out to see the crosswalks you can use.",
		],
	},
	getNamedLocationMembers: {
		title: "List a named location's areas",
		intro: "List the areas that make up a named location in a boundary release you choose, such as the wards of North Wales. Anything that can't be matched is listed too, with the reason.",
		tips: [
			"Named locations are made of local authorities. For any other geography, name a crosswalk with `via`.",
		],
	},

	// Catalogue
	listDatasets: {
		title: "List datasets",
		intro: "List every source dataset behind the Atlas, where it came from, and fingerprints of the files it was built from.",
	},
	getDataset: {
		title: "Get a dataset",
		intro: "Get one source dataset's details: its publisher, its source files and their hashes.",
	},
	listMeasures: {
		title: "List measures",
		intro: "List every measure you can query, with its unit, what it covers and whether it can be added up. A great place to start exploring.",
	},
	getMeasure: {
		title: "Get a measure",
		intro: "Everything about one measure: what it counts, its unit, whether it can be summed or averaged, and which periods and areas it's published for.",
		tips: [
			"Where another nation publishes its own version, `elsewhere` links to it and says whether the two can be compared.",
		],
	},
	getMeasureCompatibility: {
		title: "Check which boundaries fit",
		intro: "Find out which boundary releases a measure's data can be drawn on, by checking that every area code it uses is present.",
	},
	getMeasureCoverage: {
		title: "Check a measure's coverage",
		intro: "See where a measure has data, and what share of its area codes appear in each boundary release.",
	},
	getMeasureQuality: {
		title: "Check a measure's quality",
		intro: "A pre-flight check before you request data: every source and period, how its records were produced, whether it can be aggregated and which boundaries it fits.",
	},

	// Trust & citation
	getAreaCitation: {
		title: "Cite an area",
		intro: "Get everything you need to cite an area: the Atlas release, the boundary publisher and licence, fingerprints of the files involved and a ready-made attribution. Add `measure` to cite its data too.",
	},
	listRelationshipCandidates: {
		title: "List relationship candidates",
		intro: "A behind-the-scenes report of relationships between areas found in the raw boundary files, and whether each has been published as a crosswalk yet.",
	},
	getValidationReport: {
		title: "Get the validation report",
		intro: "Every check the build ran on boundaries, crosswalks and measures. Nothing is published with an unexplained failure: each accepted exception is listed with the reason it was accepted.",
		tips: ["Filter by result with `status`."],
	},
	getBoundaryReleaseValidation: {
		title: "Get checks for boundaries",
		intro: "See the checks one boundary release went through before it was published.",
	},
	getCrosswalkValidation: {
		title: "Get checks for a crosswalk",
		intro: "See the checks one crosswalk passed: its file is intact, its areas resolve and, for containment, every area has exactly one parent.",
	},
	getMeasureValidation: {
		title: "Get checks for a measure",
		intro: "See the checks that one measure's definition is consistent, both with itself and with the rest of the catalogue.",
	},
	getMeasureSourceValidation: {
		title: "Get checks for a download",
		intro: "See the checks run on one downloadable dataset: that it matches its hash, every area code resolves, it covers the right countries and its values make sense.",
	},
	getAttribution: {
		title: "Get attribution text",
		intro: "Get the publisher and licence details for the data you've used, plus a plain-text block ready to paste under a map or into a report.",
		tips: [
			"Name at least one `dataset`, `measure`, `boundaryRelease` or `crosswalk`. Each can be repeated.",
		],
	},
};
