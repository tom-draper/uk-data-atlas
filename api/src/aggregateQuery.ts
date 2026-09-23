import { isCountryCode } from "./aggregation";
import { problem, type ApiResponse } from "./routeResponse";

export type AggregateQuery = {
	period: string | null;
	geography: string | null;
	boundaryYear: string | null;
	locationId: string | null;
	areaCode: string | null;
	regionCode: string | null;
	targetCode: string | null;
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
	const period = parsedUrl.searchParams.get("period");
	const geography = parsedUrl.searchParams.get("geography");
	const boundaryYear = parsedUrl.searchParams.get("boundaryYear");
	const locationId = parsedUrl.searchParams.get("locationId");
	const areaCode = parsedUrl.searchParams.get("areaCode");
	// `regionCode` is the original spelling of `targetCode`, from when regions
	// were the only membership target. It still selects the same way.
	const regionCode = parsedUrl.searchParams.get("regionCode");
	const explicitTargetCode = parsedUrl.searchParams.get("targetCode");
	const targetCode = explicitTargetCode ?? regionCode;
	if (
		[locationId, areaCode, regionCode, explicitTargetCode].filter(Boolean)
			.length !== 1
	) {
		return problem(
			400,
			"Invalid Query",
			"Supply exactly one of locationId, for a curated named location, areaCode, for a country, or targetCode with a membership crosswalk.",
		);
	}
	if (areaCode && !isCountryCode(areaCode)) {
		return problem(
			400,
			"Invalid Query",
			"areaCode currently supports a country code only, such as E92000001. Use locationId for a curated named location.",
		);
	}
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
		regionCode,
		targetCode,
		crosswalkId: parsedUrl.searchParams.get("crosswalk"),
		pathId: parsedUrl.searchParams.get("path"),
		sourceRelease: parsedUrl.searchParams.get("sourceRelease"),
	};
};
