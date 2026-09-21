import type { MeasureSource } from "./dataCatalog";
import type { NamedLocation, NamedLocationLookup } from "./namedLocations";
import { problem, type ApiResponse } from "./routeResponse";

/** Resolve a curated location query and its catalogue failure responses. */
export const resolveAggregationLocation = ({
	locationId,
	namedLocationLookup,
}: {
	locationId: string | null;
	namedLocationLookup?: NamedLocationLookup;
}): NamedLocation | ApiResponse | undefined => {
	if (!locationId) return undefined;
	if (!namedLocationLookup) {
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the named location inventory before aggregating over a location.",
		);
	}
	const location = namedLocationLookup.get(locationId);
	return (
		location ??
		problem(404, "Not Found", "No named location matches locationId.")
	);
};

/** Ensure a curated location can be read against the selected source partition. */
export const validateAggregationLocationSource = ({
	location,
	source,
}: {
	location?: NamedLocation;
	source: MeasureSource;
}): ApiResponse | undefined => {
	if (!location || location.memberGeography === source.sourceGeography.type)
		return undefined;
	return problem(
		422,
		"Operation Not Supported",
		`${location.label} is defined as ${location.memberGeography} codes, but this source partition is ${source.sourceGeography.type}. No conversion was applied.`,
		{ code: "conversion_not_available" },
	);
};
