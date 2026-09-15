import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

const MAX_PAGE_SIZE = 500;

const readPageSize = (value: string | null): number | undefined => {
	if (value === null) return 100;
	if (!/^[1-9]\d*$/.test(value)) return undefined;
	const parsed = Number(value);
	return parsed <= MAX_PAGE_SIZE ? parsed : undefined;
};

const cursorFor = (code: string) => Buffer.from(code).toString("base64url");

const codeFromCursor = (cursor: string): string | undefined => {
	try {
		const code = Buffer.from(cursor, "base64url").toString("utf8");
		return code.length > 0 && cursorFor(code) === cursor ? code : undefined;
	} catch {
		return undefined;
	}
};

/** Published crosswalk metadata and stable record pagination. */
export const handleCrosswalkRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	const { crosswalkInventory, crosswalkLookup } = context;
	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "crosswalks"
	) {
		return crosswalkInventory
			? {
					status: 200,
					body: envelope(releaseId, crosswalkInventory.crosswalks),
				}
			: problem(
					503,
					"Catalogue Unavailable",
					"Build the crosswalk inventory before starting the API.",
				);
	}
	if (
		segments.length === 3 &&
		segments[0] === "v1" &&
		segments[1] === "crosswalks"
	) {
		const crosswalk = crosswalkLookup?.get(segments[2]!);
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
		const crosswalk = crosswalkLookup?.get(segments[2]!);
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
		const pageSize = readPageSize(parsedUrl.searchParams.get("limit"));
		if (pageSize === undefined)
			return problem(
				400,
				"Invalid Query",
				`limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`,
			);
		const cursor = parsedUrl.searchParams.get("cursor");
		const cursorCode = cursor ? codeFromCursor(cursor) : undefined;
		if (cursor && !cursorCode)
			return problem(400, "Invalid Query", "cursor is invalid.");
		const offset = cursorCode
			? crosswalk.records.findIndex(
					(record) => record.source.code === cursorCode,
				) + 1
			: 0;
		if (cursorCode && offset === 0)
			return problem(
				400,
				"Invalid Query",
				"cursor is not valid for this crosswalk.",
			);
		const records = crosswalk.records.slice(offset, offset + pageSize);
		const lastRecord = records.at(-1);
		const nextCursor =
			offset + records.length < crosswalk.records.length && lastRecord
				? cursorFor(lastRecord.source.code)
				: null;
		return { status: 200, body: envelope(releaseId, records, nextCursor) };
	}
	return undefined;
};
