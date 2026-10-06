import { paginate } from "./pagination";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/** Published crosswalk metadata and stable record pagination. */
export const handleCrosswalkRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	const resolver = context.geographyResolver;
	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "crosswalks"
	) {
		const unavailable = resolver.requires("crosswalks");
		if (unavailable) return unavailable;
		return {
			status: 200,
			body: envelope(releaseId, resolver.crosswalkSummaries()),
		};
	}
	if (
		segments.length === 3 &&
		segments[0] === "v1" &&
		segments[1] === "crosswalks"
	) {
		const crosswalk = resolver.crosswalk(segments[2]!);
		if (!crosswalk)
			return problem(
				404,
				"Not Found",
				"No crosswalk matches that identity.",
			);
		const { records, ...metadata } = crosswalk;
		return { status: 200, body: envelope(releaseId, metadata) };
	}
	if (
		segments.length === 4 &&
		segments[0] === "v1" &&
		segments[1] === "crosswalks" &&
		segments[3] === "records"
	) {
		const crosswalk = resolver.crosswalk(segments[2]!);
		if (!crosswalk)
			return problem(
				404,
				"Not Found",
				"No crosswalk matches that identity.",
			);
		const source = parsedUrl.searchParams.get("source");
		if (source !== null)
			return {
				status: 200,
				body: envelope(
					releaseId,
					crosswalk.records.filter(
						(record) => record.source.code === source,
					),
				),
			};
		const page = paginate(parsedUrl, crosswalk.records, {
			keyOf: (record) => record.source.code,
			subject: "crosswalk",
		});
		if ("problem" in page) return page.problem;
		return {
			status: 200,
			body: envelope(releaseId, page.items, page.nextCursor),
		};
	}
	return undefined;
};
