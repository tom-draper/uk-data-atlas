import type { Feature, FeatureCollection } from "geojson";

/**
 * Boundary releases whose Northern Ireland geometry is known to be displaced,
 * and what is done about it.
 *
 * Several ONS UK-wide WGS84 releases carry Northern Ireland about 60 m east
 * of its true position: the northern-ireland-offset correction, applied the
 * wrong way round. Constituencies December 2017 and travel to work areas 2011
 * carry it throughout. Constituencies December 2018 to December 2022 carry it
 * on their inland boundaries only, with a clipped coastline that is already
 * accurate, so reversing the offset there would push the coast out instead.
 *
 * Northern Ireland's eighteen constituencies were unchanged from 2008 until
 * the 2024 review, so the constituency releases from 2017 to 2022 take its
 * areas, code for code, from December 2016, which agrees with the ONS's WGS84
 * local authorities to about 2 m. Travel to work areas have no accurate
 * release to borrow from, so they are repaired by the reversed offset.
 *
 * Measured by nearest-vertex distance between releases: each release's
 * Northern Ireland vertices against December 2016 constituencies
 * (reprojected through EPSG:1314) and against May 2023 local authorities,
 * the release the northern-ireland-offset correction was calibrated on.
 */
export interface GeometrySubstitution {
	id: string;
	description: string;
	geography: string;
	/** The releases whose matching areas are replaced. */
	releases: readonly string[];
	/** Only areas whose code starts with this are replaced. */
	codePrefix: string;
	/** The release whose areas, under the same codes, replace them. */
	donor: { geography: string; boundaryRelease: string };
}

/** A release whose displacement is known but cannot yet be repaired. */
export interface KnownGeometryDisplacement {
	geography: string;
	boundaryRelease: string;
	codePrefix: string;
	description: string;
}

export const GEOMETRY_SUBSTITUTIONS: readonly GeometrySubstitution[] = [
	{
		id: "northern-ireland-constituencies-2016",
		description:
			"Northern Ireland's constituencies are taken from the December 2016 release. In this release their boundaries lie up to about 67 m east of their true position, and the eighteen constituencies were unchanged from 2008 until the 2024 review.",
		geography: "constituency",
		releases: [
			"2017-12-uk-bgc",
			"2018-12-uk-bgc",
			"2019-12-uk-bgc",
			"2020-12-uk-bgc",
			"2021-12-uk-bgc",
			"2022-12-uk-bgc",
		],
		codePrefix: "N",
		donor: { geography: "constituency", boundaryRelease: "2016-12-uk-bgc" },
	},
];

/**
 * Releases known to be displaced with no repair yet, which the API's
 * validation report has to waive to admit. None at present.
 */
export const KNOWN_GEOMETRY_DISPLACEMENTS: readonly KnownGeometryDisplacement[] =
	[];

/**
 * A grid offset applied backwards to a WGS84 release that carries it the
 * wrong way round. The areas are taken into the offset's grid, moved by its
 * exact inverse and brought back.
 */
export interface ReversedGridOffset {
	id: string;
	description: string;
	/** The grid offset definition in data/boundaries/, by id. */
	offset: string;
	geography: string;
	boundaryRelease: string;
	codePrefix: string;
}

export const REVERSED_GRID_OFFSETS: readonly ReversedGridOffset[] = [
	{
		id: "northern-ireland-offset-reversed",
		description:
			"Northern Ireland's travel to work areas are published about 60 m east of their true position, the northern-ireland-offset correction applied backwards. Its exact inverse, applied in the British National Grid, brings 63% of their vertices within 10 m of the May 2023 local authorities, against 5% as published.",
		offset: "northern-ireland-offset",
		geography: "travelToWorkArea",
		boundaryRelease: "2011-12-uk-gcb",
		codePrefix: "N",
	},
];

export const reversedOffsetsFor = (
	geography: string,
	boundaryRelease: string,
): ReversedGridOffset[] =>
	REVERSED_GRID_OFFSETS.filter(
		(reversed) =>
			reversed.geography === geography &&
			reversed.boundaryRelease === boundaryRelease,
	);

export const substitutionsFor = (
	geography: string,
	boundaryRelease: string,
): GeometrySubstitution[] =>
	GEOMETRY_SUBSTITUTIONS.filter(
		(substitution) =>
			substitution.geography === geography &&
			substitution.releases.includes(boundaryRelease),
	);

export const knownDisplacementsFor = (
	geography: string,
	boundaryRelease: string,
): KnownGeometryDisplacement[] =>
	KNOWN_GEOMETRY_DISPLACEMENTS.filter(
		(displacement) =>
			displacement.geography === geography &&
			displacement.boundaryRelease === boundaryRelease,
	);

const codeOf = (feature: Feature, codeKey: string) => {
	const code = feature.properties?.[codeKey];
	return typeof code === "string" ? code : undefined;
};

/**
 * Replaces the geometry of every target feature the substitution covers with
 * the donor's feature under the same code. Both collections must already be
 * in the same CRS. Throws rather than serve a mixture when the two releases
 * do not hold exactly the same covered codes.
 */
export const substituteFeatures = <T extends FeatureCollection>(
	target: T,
	targetCodeKey: string,
	donor: FeatureCollection,
	donorCodeKey: string,
	substitution: Pick<GeometrySubstitution, "id" | "codePrefix">,
	label: string,
): T => {
	const covered = (code: string | undefined): code is string =>
		code !== undefined && code.startsWith(substitution.codePrefix);
	const donorGeometry = new Map(
		donor.features.flatMap((feature) => {
			const code = codeOf(feature, donorCodeKey);
			return covered(code) && feature.geometry
				? [[code, feature.geometry] as const]
				: [];
		}),
	);
	const coveredTargetCodes = target.features
		.map((feature) => codeOf(feature, targetCodeKey))
		.filter(covered);
	const targetCodes = new Set(coveredTargetCodes);
	// A code split over several features would receive the donor's whole
	// area once per fragment.
	if (targetCodes.size !== coveredTargetCodes.length)
		throw new Error(
			`${label}: ${substitution.id} expects one feature per code, but the target repeats a code.`,
		);
	const unmatched = [
		...[...targetCodes].filter((code) => !donorGeometry.has(code)),
		...[...donorGeometry.keys()].filter((code) => !targetCodes.has(code)),
	];
	if (targetCodes.size === 0 || unmatched.length > 0)
		throw new Error(
			`${label}: ${substitution.id} needs the same ${substitution.codePrefix} codes in both releases; ${
				targetCodes.size === 0
					? "the target has none"
					: `unmatched: ${unmatched.sort().join(", ")}`
			}.`,
		);
	return {
		...target,
		features: target.features.map((feature) => {
			const code = codeOf(feature, targetCodeKey);
			return covered(code)
				? { ...feature, geometry: donorGeometry.get(code)! }
				: feature;
		}),
	};
};
