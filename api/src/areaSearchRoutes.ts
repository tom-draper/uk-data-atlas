import type { AreaLookup } from "./areaInventory";
import {
	cursorFor,
	keyFromCursor,
	MAX_PAGE_SIZE,
	readPageSize,
} from "./pagination";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type {
	AreaSearchIndex,
	AreaSearchResult,
	RouteRequest,
} from "./routing";

/** Every compiled area identity, sorted by id for stable pagination. */
export const createAreaSearchIndex = (
	areaLookup: AreaLookup,
): AreaSearchIndex =>
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
	const filtered = (
		areaSearchIndex ?? createAreaSearchIndex(areaLookup)
	).filter(
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
	const limit = readPageSize(parsedUrl.searchParams.get("limit"));
	if (limit === undefined)
		return problem(
			400,
			"Invalid Query",
			`limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`,
		);
	const cursor = parsedUrl.searchParams.get("cursor");
	const id = cursor ? keyFromCursor(cursor) : undefined;
	if (cursor && !id)
		return problem(400, "Invalid Query", "cursor is invalid.", {
			code: "invalid_cursor",
		});
	const offset = id ? matches.findIndex((area) => area.id === id) + 1 : 0;
	if (id && offset === 0)
		return problem(
			400,
			"Invalid Query",
			"cursor is not valid for this area query.",
			{ code: "invalid_cursor" },
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
