import { isCountryCode } from "./aggregation";
import { defaultSource } from "./dataDefaults";
import type { Measure } from "./dataCatalog";
import type { GeographyResolver } from "./geographyResolver";
import { parsePlaceParameter, type PlaceParameter } from "./placeParameter";
import {
	parseExactReleaseReference,
	type ExactReleaseReference,
} from "./releaseForDate";
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
	from: ExactReleaseReference | null;
	defaulted: Record<string, string | number>;
};

/** Parse and validate the query vocabulary shared by data aggregation. */
export const parseAggregateQuery = ({
	parsedUrl,
	measureId,
	measure,
	geographyResolver,
}: {
	parsedUrl: URL;
	measureId: string;
	measure: Measure;
	geographyResolver: GeographyResolver;
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
	const parsedPlace = parsePlaceParameter(
		parsedUrl.searchParams,
		measureId,
		false,
	);
	if (parsedPlace && "status" in parsedPlace) return parsedPlace;
	if (!parsedPlace)
		return problem(
			400,
			"Invalid Query",
			"place is required: location/{id} for a curated named location, a country code such as E92000001, or an area code a membership crosswalk groups members into.",
		);
	const placeText = parsedUrl.searchParams.get("place")?.trim() ?? "";
	const nameCandidates = placeText.includes("/")
		? []
		: geographyResolver
				.places(placeText, 12)
				.filter(
					(candidate) =>
						candidate.match !== "prefix" &&
						(candidate.kind === "named-location" ||
							(candidate.geography === "country" &&
								isCountryCode(candidate.code))) &&
						measure.sources.some(
							(source) =>
								source.sourceGeography.type ===
								(candidate.kind === "named-location"
									? candidate.memberGeography
									: "localAuthority"),
						),
				);
	const named = nameCandidates.length === 1 ? nameCandidates[0] : undefined;
	const place: PlaceParameter = named
		? named.kind === "named-location"
			? { kind: "location", id: named.code }
			: { kind: "area", code: named.code, geography: named.geography }
		: parsedPlace;
	const impliedSourceGeography =
		named?.kind === "named-location"
			? (named.memberGeography ?? null)
			: named && isCountryCode(named.code)
				? "localAuthority"
				: null;
	const requested = {
		period: parsedUrl.searchParams.get("period"),
		geography:
			parsedUrl.searchParams.get("geography") ?? impliedSourceGeography,
		boundaryYear: parsedUrl.searchParams.get("boundaryYear"),
		datasetId: parsedUrl.searchParams.get("datasetId"),
	};
	const defaults = defaultSource(measure, requested);
	const period = requested.period ?? defaults?.period ?? null;
	// The geography here is the members', which a place reference to the
	// whole does not name, so it is only ever the one given.
	const geography = requested.geography ?? defaults?.geography ?? null;
	const boundaryYear =
		requested.boundaryYear ?? defaults?.boundaryYear ?? null;
	const crosswalkId = parsedUrl.searchParams.get("crosswalk");
	const pathId = parsedUrl.searchParams.get("path");
	const fromParameter = parsedUrl.searchParams.get("from");
	const from = parseExactReleaseReference(fromParameter);
	if (fromParameter !== null && !from)
		return problem(
			400,
			"Invalid Query",
			"from must be an exact geography/release reference.",
		);
	if (from && geography && from.geography !== geography)
		return problem(
			400,
			"Invalid Query",
			"from must name the same geography as the source partition.",
		);
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
		from: from ?? null,
		defaulted: defaults?.defaulted ?? {},
	};
};
