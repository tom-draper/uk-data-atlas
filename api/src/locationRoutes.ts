import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/** Discovery endpoints for the Atlas's curated named locations. */
export const handleLocationRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	const { namedLocationInventory, namedLocationLookup } = context;
	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "locations"
	) {
		if (!namedLocationInventory)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the named location inventory before listing locations.",
			);
		const query = parsedUrl.searchParams
			.get("q")
			?.trim()
			.toLocaleLowerCase();
		const locations = namedLocationInventory.locations.filter(
			(location) =>
				!query ||
				location.id.startsWith(query) ||
				location.label.toLocaleLowerCase().startsWith(query),
		);
		return { status: 200, body: envelope(releaseId, locations) };
	}
	if (
		segments.length === 3 &&
		segments[0] === "v1" &&
		segments[1] === "locations"
	) {
		const location = namedLocationLookup?.get(segments[2]!);
		return location
			? { status: 200, body: envelope(releaseId, location) }
			: problem(
					404,
					"Not Found",
					"No named location matches that identity.",
				);
	}
	return undefined;
};
