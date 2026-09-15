import type { AreaLookup } from "./areaInventory";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type {
	AreaSearchIndex,
	AreaSearchResult,
	RouteRequest,
} from "./routing";

const MAX_PAGE_SIZE = 500;

const searchableAreas = (areaLookup: AreaLookup): AreaSearchIndex =>
	[...areaLookup.entries()]
		.flatMap(([identity, areas]) => {
			const slash = identity.indexOf("/");
			const geography = identity.slice(0, slash);
			const boundaryRelease = identity.slice(slash + 1);
			return [...areas.values()].map((area) => ({
				id: [geography, boundaryRelease, area.code].join("/"),
				geography,
				boundaryRelease,
				...area,
			}));
		})
		.sort((left, right) => left.id.localeCompare(right.id));

const matchesQuery = (area: AreaSearchResult, query: string) => {
	const normalized = query.toLocaleLowerCase();
	return (
		area.code.toLocaleLowerCase().startsWith(normalized) ||
		area.name.toLocaleLowerCase().startsWith(normalized) ||
		area.aliases?.some((alias) =>
			alias.toLocaleLowerCase().startsWith(normalized),
		) === true
	);
};

const pageSize = (value: string | null) => {
	if (value === null) return 100;
	if (!/^[1-9]\d*$/.test(value)) return undefined;
	const parsed = Number(value);
	return parsed <= MAX_PAGE_SIZE ? parsed : undefined;
};

const cursorFor = (id: string) => Buffer.from(id).toString("base64url");
const cursorValue = (cursor: string) => {
	try {
		const value = Buffer.from(cursor, "base64url").toString("utf8");
		return value.length > 0 && cursorFor(value) === cursor
			? value
			: undefined;
	} catch {
		return undefined;
	}
};

/** Search compiled area identities with stable cursor pagination. */
export const handleAreaSearchRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		segments[1] !== "areas"
	)
		return undefined;
	const { areaLookup, areaSearchIndex } = context;
	if (!areaLookup)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the area inventory before searching areas.",
		);
	const geography = parsedUrl.searchParams.get("geography");
	const boundaryRelease = parsedUrl.searchParams.get("release");
	const query = parsedUrl.searchParams.get("q")?.trim();
	const filtered = (areaSearchIndex ?? searchableAreas(areaLookup)).filter(
		(area) =>
			(geography === null || area.geography === geography) &&
			(boundaryRelease === null ||
				area.boundaryRelease === boundaryRelease),
	);
	const exact = query
		? filtered.filter(
				(area) =>
					area.code.toLocaleLowerCase() === query.toLocaleLowerCase(),
			)
		: [];
	const matches = query
		? exact.length > 0
			? exact
			: filtered.filter((area) => matchesQuery(area, query))
		: filtered;
	const limit = pageSize(parsedUrl.searchParams.get("limit"));
	if (limit === undefined)
		return problem(
			400,
			"Invalid Query",
			`limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`,
		);
	const cursor = parsedUrl.searchParams.get("cursor");
	const id = cursor ? cursorValue(cursor) : undefined;
	if (cursor && !id)
		return problem(400, "Invalid Query", "cursor is invalid.");
	const offset = id ? matches.findIndex((area) => area.id === id) + 1 : 0;
	if (id && offset === 0)
		return problem(
			400,
			"Invalid Query",
			"cursor is not valid for this area query.",
		);
	const areas = matches.slice(offset, offset + limit);
	const last = areas.at(-1);
	return {
		status: 200,
		body: envelope(
			releaseId,
			areas,
			offset + areas.length < matches.length && last
				? cursorFor(last.id)
				: null,
		),
	};
};
