import { isCountryCode } from "./aggregation";
import { parsePlaceParameter } from "./placeParameter";
import { problem, type ApiResponse } from "./routeResponse";

export type AggregateQuery = {
	period: string | null;
	geography: string | null;
	boundaryYear: string | null;
	locationId: string | null;
	areaCode: string | null;
	targetCode: string | null;
	/** The geography a place reference names for the target, if it names one. */
	targetGeography: string | null;
	crosswalkId: string | null;
	pathId: string | null;
	sourceRelease: string | null;
};

/** Parse and validate the query vocabulary shared by data aggregation. */
export const parseAggregateQuery = ({
	parsedUrl,
	measureId,
}: {
	parsedUrl: URL;
	measureId: string;
}): AggregateQuery | ApiResponse => {
	if (
		parsedUrl.searchParams.has("release") ||
		parsedUrl.searchParams.has("conversion")
	) {
		return problem(
			422,
			"Operation Not Supported",
			"This aggregation does not select a geometry release or convert observations.",
		);
	}
	const place = parsePlaceParameter(parsedUrl.searchParams, measureId, false);
	if (place && "status" in place) return place;
	if (!place)
		return problem(
			400,
			"Invalid Query",
			"place is required: location/{id} for a curated named location, a country code such as E92000001, or an area code a membership crosswalk groups members into.",
		);
	const period = parsedUrl.searchParams.get("period");
	// The geography here is the members', which a place reference to the
	// whole does not name, so it is only ever the one given.
	const geography = parsedUrl.searchParams.get("geography");
	const boundaryYear = parsedUrl.searchParams.get("boundaryYear");
	const crosswalkId = parsedUrl.searchParams.get("crosswalk");
	const pathId = parsedUrl.searchParams.get("path");
	const locationId = place.kind === "location" ? place.id : null;
	// A country is summed from its members without a crosswalk; any other
	// area is a target a named membership crosswalk groups members into.
	const areaCode =
		place.kind === "area" &&
		!crosswalkId &&
		!pathId &&
		isCountryCode(place.code)
			? place.code
			: null;
	const targetCode =
		place.kind === "area" && areaCode === null ? place.code : null;
	// A reference such as region/E12000001 says which geography the members
	// are summed onto, and the crosswalk must reach it.
	const targetGeography =
		targetCode && place.kind === "area" ? (place.geography ?? null) : null;
	if (targetCode && !crosswalkId && !pathId)
		return problem(
			400,
			"Invalid Query",
			`${targetCode} is not a country, so it is summed through a membership crosswalk: name one as crosswalk, or a path as path. A curated location is location/{id}.`,
		);
	if (period === null || geography === null || boundaryYear === null) {
		return problem(
			400,
			"Invalid Query",
			`${measureId} has no published source for that period, geography and boundary year.`,
		);
	}
	return {
		period,
		geography,
		boundaryYear,
		locationId,
		areaCode,
		targetCode,
		targetGeography,
		crosswalkId,
		pathId,
		sourceRelease: parsedUrl.searchParams.get("sourceRelease"),
	};
};
