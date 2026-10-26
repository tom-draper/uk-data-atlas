import { z } from "zod";
import { buildUrl, segment, type ApiClient, type Query } from "./client.ts";
import { inputError, render, type TextResult } from "./result.ts";

/** One MCP tool: a front-door route, described for a model. */
export interface Tool<Shape extends z.ZodRawShape = z.ZodRawShape> {
	name: string;
	title: string;
	description: string;
	inputSchema: Shape;
	run(
		args: z.infer<z.ZodObject<Shape>>,
		client: ApiClient,
	): Promise<TextResult>;
}

const defineTool = <Shape extends z.ZodRawShape>(tool: Tool<Shape>) => tool;

/** Fetch `path` and shape the reply, or report a bad input without fetching. */
async function call(
	client: ApiClient,
	path: string,
	query: Query,
	transform?: (data: unknown) => unknown,
) {
	const request = buildUrl(client.baseUrl, path, query);
	return render(request, await client.get(path, query), transform);
}

const PLACE_REF_NOTE =
	"A place reference such as `localAuthority/E08000003` (from find_place) asks about one exact area.";

export const findPlace = defineTool({
	name: "find_place",
	title: "Find a place",
	description:
		"Search UK places by name, area code or postcode. Returns every candidate the text could mean " +
		"(a local authority, county, ward, town, region and so on), each with its kind, geography, code, " +
		"a `place` reference and the boundary releases that hold it. It never picks one for you: " +
		'"Newport" or "Manchester" has several meanings, so show the user the options or ask. ' +
		"Use this first when a name is ambiguous, then pass a candidate's `place` reference to other tools.",
	inputSchema: {
		q: z
			.string()
			.min(1)
			.describe(
				"A place name, an area code (E08000003), a unit postcode, or a place reference like `localAuthority/E08000003`.",
			),
		limit: z
			.number()
			.int()
			.min(1)
			.max(50)
			.optional()
			.describe("How many candidates to return. Defaults to 10."),
		geography: z
			.string()
			.optional()
			.describe(
				"Restrict an exact code lookup to one geography, such as `ward` or `localAuthority`.",
			),
	},
	run: ({ q, limit, geography }, client) =>
		call(client, "/places", { q, limit, geography }),
});

export const getValue = defineTool({
	name: "get_value",
	title: "Get a measure's value for a place",
	description:
		"Answer a question like 'what is the population of North Wales?' in one call. Give a measure id " +
		"(from find_measures) and a place (name, code, postcode or place reference). The reply has the value, " +
		"its unit and period, the place it resolved to, the `method` used (for example an aggregate of " +
		"several areas) and `otherMatches` for other places the name could have meant. If `period` is omitted " +
		"the latest is used and the reply says so (`periodDefaulted`). Always state the period, the method and " +
		"any defaulting when you quote the number. If the name is ambiguous the call fails with the choices; " +
		"do not guess between them.",
	inputSchema: {
		measure: z
			.string()
			.min(1)
			.describe(
				"A measure id or alias from find_measures, such as `population` or `house-prices`.",
			),
		place: z
			.string()
			.optional()
			.describe(
				`A place name, code, postcode or place reference. ${PLACE_REF_NOTE} Give this or \`postcode\`.`,
			),
		postcode: z
			.string()
			.optional()
			.describe(
				"A full unit postcode, such as `SW1A 1AA`, answered in `geography` if given. Give this or `place`.",
			),
		period: z
			.string()
			.optional()
			.describe(
				"A published period such as `2022`. Omit for the latest.",
			),
		geography: z
			.string()
			.optional()
			.describe(
				"The source geography to answer from, such as `localAuthority` or `lsoa`. Omit for the finest that answers.",
			),
		codeYear: z
			.string()
			.regex(/^\d{4}$/)
			.optional()
			.describe(
				"With `postcode`, the boundary year of the partition to answer from. Omit for the newest.",
			),
	},
	run: (
		{ measure, place, postcode, period, geography, codeYear },
		client,
	) => {
		if (!place && !postcode)
			return Promise.resolve(
				inputError("Give either `place` or `postcode`."),
			);
		return call(client, `/data/${segment(measure)}/value`, {
			place,
			postcode,
			period,
			geography,
			codeYear,
		});
	},
});

export const getSeries = defineTool({
	name: "get_series",
	title: "Get a measure over time for one place",
	description:
		"All published periods of a measure for one area, for trends ('how has population in Wigan changed?'). " +
		"Values are source-exact: every period is on the same area codes, with no conversion. The reply's " +
		"`defaults` lists what the API chose for you (source geography, boundary year); repeat those when " +
		"describing the series. A name meaning several areas fails with the choices, so pass a place reference " +
		"from find_place. Use get_value instead for a single figure.",
	inputSchema: {
		measure: z
			.string()
			.min(1)
			.describe("A measure id or alias from find_measures."),
		place: z
			.string()
			.min(1)
			.describe(
				`An area name, code or place reference. ${PLACE_REF_NOTE}`,
			),
		geography: z
			.string()
			.optional()
			.describe(
				"Source geography, such as `localAuthority`. Omit when `place` leaves no choice.",
			),
		codeYear: z
			.number()
			.int()
			.optional()
			.describe(
				"Year of the boundaries the values are published on. Omit for the newest.",
			),
		datasetId: z
			.string()
			.optional()
			.describe(
				"Choose a dataset when the measure has several for the same geography and year.",
			),
	},
	run: ({ measure, place, geography, codeYear, datasetId }, client) =>
		call(client, `/data/${segment(measure)}/series`, {
			place,
			geography,
			codeYear,
			datasetId,
		}),
});

export const findMeasures = defineTool({
	name: "find_measures",
	title: "Find measures",
	description:
		"Search the catalogue of published measures by the words people use ('house prices', 'deprivation', " +
		"'life expectancy'). Returns measure ids with labels, units, what they can be aggregated by and their " +
		"source geographies, best match first. It lists every plausible match rather than choosing one. " +
		"Use the returned `id` in get_value and get_series. Omit `q` to list all measures.",
	inputSchema: {
		q: z
			.string()
			.optional()
			.describe(
				"Words to search by, such as `house prices`. Omit to list every measure.",
			),
	},
	run: ({ q }, client) => call(client, "/measures", { q }),
});

export const locate = defineTool({
	name: "locate",
	title: "What is at this postcode or point",
	description:
		"Say which areas contain a postcode or a point. With `postcode` it returns the postcode's local " +
		"authority, ward and Westminster constituency (or the geographies you name) with the directory's " +
		"stated positional accuracy. With `lat` and `lng`, or `easting` and `northing`, or a `gridref`, it " +
		"tests that point against each geography. A postcode is placed by one centroid, so addresses near a " +
		"boundary can fall on the other side; pass that caution on. Give exactly one of postcode, lat+lng, " +
		"easting+northing or gridref.",
	inputSchema: {
		postcode: z
			.string()
			.optional()
			.describe("A full unit postcode, such as `SW1A 1AA`."),
		lat: z
			.number()
			.min(-90)
			.max(90)
			.optional()
			.describe("WGS 84 latitude."),
		lng: z
			.number()
			.min(-180)
			.max(180)
			.optional()
			.describe("WGS 84 longitude."),
		easting: z
			.number()
			.optional()
			.describe(
				"British National Grid easting in metres, with `northing`.",
			),
		northing: z
			.number()
			.optional()
			.describe(
				"British National Grid northing in metres, with `easting`.",
			),
		gridref: z
			.string()
			.optional()
			.describe(
				"An Ordnance Survey grid reference, such as `TQ 30000 80000`.",
			),
		geography: z
			.array(z.string())
			.max(4)
			.optional()
			.describe(
				"Up to four geographies to look up, such as `ward`, `lsoa`, `localAuthority`. The default is local authority, ward and constituency.",
			),
		date: z
			.string()
			.optional()
			.describe(
				"`YYYY-MM-DD` or `YYYY-MM`: use the boundaries current at that date. Omit for the newest.",
			),
	},
	run: (args, client) => {
		const {
			postcode,
			lat,
			lng,
			easting,
			northing,
			gridref,
			geography,
			date,
		} = args;
		const given = [
			postcode !== undefined,
			lat !== undefined || lng !== undefined,
			easting !== undefined || northing !== undefined,
			gridref !== undefined,
		].filter(Boolean).length;
		if (given !== 1) {
			return Promise.resolve(
				inputError(
					"Give exactly one of `postcode`, `lat` with `lng`, `easting` with `northing`, or `gridref`.",
				),
			);
		}
		if (postcode !== undefined) {
			return call(client, `/postcodes/${segment(postcode)}`, {
				geography,
				date,
			});
		}
		if (lat !== undefined || lng !== undefined) {
			if (lat === undefined || lng === undefined)
				return Promise.resolve(
					inputError("Give both `lat` and `lng`."),
				);
			return call(client, "/areas:contains", {
				lat,
				lng,
				geography,
				date,
			});
		}
		if (gridref !== undefined) {
			return call(client, "/areas:contains", {
				crs: "EPSG:27700",
				gridref,
				geography,
				date,
			});
		}
		if (easting === undefined || northing === undefined)
			return Promise.resolve(
				inputError("Give both `easting` and `northing`."),
			);
		return call(client, "/areas:contains", {
			crs: "EPSG:27700",
			easting,
			northing,
			geography,
			date,
		});
	},
});

const AREA_VIEWS = {
	identity: "",
	history: "/history",
	parents: "/parents",
	children: "/children",
} as const;

export const getArea = defineTool({
	name: "get_area",
	title: "Get an area, its history, parents or children",
	description:
		"Details of one official area identified by geography, boundary release and code (all three come " +
		"from find_place). `view` chooses what to return: `identity` (the area itself), `history` (what it " +
		"replaced or became after reorganisations, plus other releases holding the same code), `parents` " +
		"(the areas that contain it, such as a ward's local authority) or `children` (the areas inside it, " +
		"such as a council's wards). Use release `latest` for the newest. Same-code continuity across " +
		"releases does not prove the boundary is unchanged.",
	inputSchema: {
		geography: z
			.string()
			.min(1)
			.describe(
				"Geography type id, such as `localAuthority`, `ward` or `constituency`.",
			),
		code: z
			.string()
			.min(1)
			.describe("The area's official code, such as `E06000023`."),
		release: z
			.string()
			.min(1)
			.default("latest")
			.describe(
				"Boundary release id, such as `2025-12-uk-bgc`, or `latest` (the default).",
			),
		view: z
			.enum(["identity", "history", "parents", "children"])
			.default("identity")
			.describe("What to return about the area. Defaults to `identity`."),
		depth: z
			.number()
			.int()
			.min(1)
			.optional()
			.describe(
				"For history, parents or children: how many hops to follow.",
			),
		childGeography: z
			.string()
			.optional()
			.describe(
				"For `children`: restrict to one geography, such as `ward`.",
			),
		include: z
			.array(z.enum(["capabilities", "citation", "metrics"]))
			.optional()
			.describe(
				"For `identity`: extra reports. `citation` returns text to cite the area's sources.",
			),
	},
	run: (
		{ geography, code, release, view, depth, childGeography, include },
		client,
	) => {
		const path = `/areas/${segment(geography)}/${segment(release)}/${segment(code)}${AREA_VIEWS[view]}`;
		return call(client, path, {
			depth: view === "identity" ? undefined : depth,
			childGeography: view === "children" ? childGeography : undefined,
			include: view === "identity" ? include : undefined,
		});
	},
});

export const convertCode = defineTool({
	name: "convert_code",
	title: "Convert an area code between boundary releases",
	description:
		"Translate one area code from one boundary release to another through a published crosswalk, in " +
		"either direction (for example a 2019 ward code to its 2024 equivalents). `purpose` states what the " +
		"conversion is for: `identity` for official historical lookups, `membership` for clean containment, " +
		"or `apportion` for area-overlap shares (weights say how much of the source falls in each target). " +
		"The reply names the path used and its quality. If no published path exists the call fails; do not " +
		"invent a mapping.",
	inputSchema: {
		from: z
			.string()
			.min(1)
			.describe(
				"The code's source release as `{geography}/{release}`, such as `ward/2019-12-uk-bgc`.",
			),
		code: z
			.string()
			.min(1)
			.describe("The area code as published in `from`."),
		to: z
			.string()
			.min(1)
			.describe("The target release as `{geography}/{release}`."),
		purpose: z
			.enum(["identity", "membership", "apportion"])
			.optional()
			.describe(
				"What the translation is for. The API picks a suitable path when omitted.",
			),
	},
	run: ({ from, code, to, purpose }, client) =>
		call(client, "/translations", { from, code, to, purpose }),
});

/** Turn the root-relative links in a release's `downloads` into full URLs. */
const absoluteLinks = (origin: string) =>
	function walk(value: unknown): unknown {
		if (typeof value === "string")
			return value.startsWith("/") && !value.startsWith("//")
				? `${origin}${value}`
				: value;
		if (Array.isArray(value)) return value.map(walk);
		if (value && typeof value === "object")
			return Object.fromEntries(
				Object.entries(value).map(([key, inner]) => [key, walk(inner)]),
			);
		return value;
	};

export const boundaryReleases = defineTool({
	name: "boundary_releases",
	title: "Boundary releases and downloads",
	description:
		"Browse the boundary archive. With `geography` and `release` it returns that release with its licence " +
		"and links to download it whole (GeoJSON, GeoParquet, PMTiles). With `geography` and `date` it picks " +
		"the release that was current on that date. With neither it lists every release (use `geography` " +
		"alone to filter the list). Releases are dated snapshots, not legal statements of what was in force. " +
		"Quote the source licence when you pass a download link on.",
	inputSchema: {
		geography: z
			.string()
			.optional()
			.describe(
				"Geography type id, such as `ward`. Needed with `release` or `date`.",
			),
		release: z
			.string()
			.optional()
			.describe(
				"A release id, such as `2024-07-uk-bgc`, or `latest`. Returns it with download links.",
			),
		date: z
			.string()
			.optional()
			.describe(
				"`YYYY-MM-DD` or `YYYY-MM`: find the release current then. Needs `geography`.",
			),
		country: z
			.enum(["GB-ENG", "GB-NIR", "GB-SCT", "GB-WLS"])
			.optional()
			.describe("With `date`: only releases covering this country."),
	},
	run: ({ geography, release, date, country }, client) => {
		const links = (data: unknown) => absoluteLinks(client.origin)(data);
		if (release !== undefined && date !== undefined)
			return Promise.resolve(
				inputError("Give `release` or `date`, not both."),
			);
		if ((release !== undefined || date !== undefined) && !geography)
			return Promise.resolve(
				inputError("`geography` is required with `release` or `date`."),
			);
		if (release !== undefined) {
			return call(
				client,
				`/boundary-releases/${segment(geography!)}/${segment(release)}`,
				{},
				links,
			);
		}
		if (date !== undefined) {
			return call(
				client,
				"/boundary-releases:resolve",
				{ geography, date, country },
				links,
			);
		}
		return call(client, "/boundary-releases", {}, (data) =>
			geography && Array.isArray(data)
				? data.filter(
						(entry) =>
							(entry as { geography?: string }).geography ===
							geography,
					)
				: data,
		);
	},
});

export const tools = [
	findPlace,
	getValue,
	getSeries,
	findMeasures,
	locate,
	getArea,
	convertCode,
	boundaryReleases,
];
