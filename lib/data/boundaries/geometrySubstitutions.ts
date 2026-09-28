import type { Feature, FeatureCollection } from "geojson";

/**
 * Boundary releases whose Northern Ireland geometry is known to be displaced,
 * and what is done about it.
 *
 * The ONS's UK-wide WGS84 constituency releases from December 2017 to
 * December 2022 carry Northern Ireland's inland boundaries 55 to 67 m east of
 * their true position (about 67 m in Belfast), while their clipped coastline
 * is accurate. Because only part of each area is displaced, no grid offset
 * can repair them. Northern Ireland's eighteen constituencies were unchanged
 * from 2008 until the 2024 review, so these releases take Northern Ireland's
 * shapes, code for code, from the December 2016 release, which agrees with
 * the ONS's own WGS84 local authorities to about 2 m.
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
			"Northern Ireland's constituencies are taken from the December 2016 release. In this release their inland boundaries lie 55 to 67 m east of their true position while the coastline is accurate, and the eighteen constituencies were unchanged from 2008 until the 2024 review.",
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

export const KNOWN_GEOMETRY_DISPLACEMENTS: readonly KnownGeometryDisplacement[] =
	[
		{
			geography: "travelToWorkArea",
			boundaryRelease: "2011-12-uk-gcb",
			codePrefix: "N",
			description:
				"Northern Ireland's travel to work areas lie a median 59 m from their true position, most of it eastward, with the clipped coastline accurate. No accurate copy of this release is held to repair it from.",
		},
	];

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
