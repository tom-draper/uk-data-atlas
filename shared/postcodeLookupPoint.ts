import {
	parseLookupCoordinate,
	type LookupPoint,
} from "@uk-data-atlas/geography/lookup-coordinates";
import type { PostcodeCentroid } from "./postcodeIndex";

/**
 * The postcode's centroid as a lookup point. Where the directory states the
 * centroid's accuracy it becomes the point's; where it does not, the point
 * carries only the precision of its grid reference, and the caller must say
 * that its boundary tolerance is understated.
 */
export const postcodeLookupPoint = (
	centroid: PostcodeCentroid,
): LookupPoint => {
	const { accuracyM } = centroid.positionalQuality;
	return parseLookupCoordinate(
		centroid.crs,
		{
			easting: String(centroid.easting),
			northing: String(centroid.northing),
		},
		accuracyM === null || accuracyM <= 0.5 ? undefined : accuracyM,
	)!;
};
