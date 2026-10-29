import {
	envelope,
	problem,
	type ApiResponse,
} from "@uk-data-atlas/atlas-runtime/api";
import type { RouteRequestFor } from "@uk-data-atlas/atlas-runtime/api";

export const handleAtlasPageRoutes = ({
	context,
	releaseId,
	segments,
}: RouteRequestFor<never>): ApiResponse | undefined => {
	if (
		segments.length !== 3 ||
		segments[0] !== "v1" ||
		segments[1] !== "atlas-pages" ||
		!segments[2]?.endsWith(".json")
	)
		return undefined;
	const id = segments[2].slice(0, -".json".length);
	const page = context.atlasPages?.get(id);
	if (page)
		return {
			status: 200,
			body: envelope(releaseId, {
				id,
				href: `/v1/atlas-pages/${id}.json`,
				contentHash: page.contentHash,
			}),
			representation: { contentType: "application/json", body: page },
		};
	return context.atlasPages?.size
		? problem(404, "Not Found", "No atlas page matches that id.")
		: problem(
				503,
				"Catalogue Unavailable",
				"Build the atlas pages before downloading them.",
			);
};

export const handleAtlasLookupRoutes = ({
	context,
	releaseId,
	segments,
}: RouteRequestFor<never>): ApiResponse | undefined => {
	if (
		segments.length !== 3 ||
		segments[0] !== "v1" ||
		segments[1] !== "atlas-lookups" ||
		!segments[2]?.endsWith(".json")
	)
		return undefined;
	const id = segments[2].slice(0, -".json".length);
	const lookup = context.atlasLookups?.get(id);
	if (lookup)
		return {
			status: 200,
			body: envelope(releaseId, {
				id,
				href: `/v1/atlas-lookups/${id}.json`,
				contentHash: lookup.contentHash,
			}),
			representation: { contentType: "application/json", body: lookup },
		};
	return context.atlasLookups?.size
		? problem(404, "Not Found", "No atlas lookup matches that id.")
		: problem(
				503,
				"Catalogue Unavailable",
				"Build the atlas lookups before downloading them.",
			);
};
