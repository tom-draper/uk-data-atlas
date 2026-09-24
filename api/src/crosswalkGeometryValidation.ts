import { AreaGeometryCache, type GeometrySourceLookup } from "./areaGeometry";
import { containPoint, ringsOf } from "./areaContainment";
import { boundaryDistanceWithinM } from "./areaDistance";
import type { CrosswalkArea } from "./crosswalkInventory";
import { releaseKey } from "./geographyKeys";

export type GeometryContainmentValidation =
	| {
			status: "verified";
			sourceAreaCount: number;
			testedVertexCount: number;
			boundaryVertexCount: number;
			/** How far outside its parent a vertex may lie and still be within. */
			toleranceM: number;
			/** Vertices outside their parent, but within the tolerance of it. */
			toleratedVertexCount: number;
			/** The furthest any tolerated vertex lies outside its parent. */
			widestOutsideM: number;
	  }
	| { status: "not-available"; reason: string };

/**
 * How far outside its declared parent a child's vertex may lie. Generalised
 * boundaries are simplified separately for each geography, so a shared edge
 * does not coincide exactly: an exact test fails on noise of a metre or two.
 * Half the 100 m sliver width every geometric crosswalk uses is the same
 * line geometric containment draws between within and indeterminate.
 */
export const CONTAINMENT_TOLERANCE_M = 50;

/**
 * Independently check a publisher's clean-containment lookup against the two
 * released geometries. This is a validation gate, never a way to infer a new
 * relationship: missing geometry remains an explicit unavailable result.
 */
export const validateGeometryContainment = (
	repositoryRoot: string,
	geometrySources: GeometrySourceLookup | undefined,
	{
		crosswalkId,
		from,
		to,
		records,
	}: {
		crosswalkId: string;
		from: { geography: string; boundaryRelease: string };
		to: { geography: string; boundaryRelease: string };
		records: Array<{ source: CrosswalkArea; targets: CrosswalkArea[] }>;
	},
): GeometryContainmentValidation => {
	if (!geometrySources) {
		return {
			status: "not-available",
			reason: "No geometry source registry was supplied to the crosswalk compiler.",
		};
	}
	for (const endpoint of [from, to]) {
		if (
			!geometrySources.has(
				releaseKey(endpoint.geography, endpoint.boundaryRelease),
			)
		) {
			return {
				status: "not-available",
				reason: `No geometry source is available for ${endpoint.geography}/${endpoint.boundaryRelease}.`,
			};
		}
	}
	const cache = new AreaGeometryCache(repositoryRoot, geometrySources, 2);
	let testedVertexCount = 0;
	let boundaryVertexCount = 0;
	let toleratedVertexCount = 0;
	let widestOutsideM = 0;
	for (const record of records) {
		if (record.targets.length !== 1) {
			throw new Error(
				`${crosswalkId}: clean containment requires one target for ${record.source.code}, found ${record.targets.length}.`,
			);
		}
		const target = record.targets[0]!;
		const child = cache.get(
			from.geography,
			from.boundaryRelease,
			record.source.code,
		);
		const parent = cache.get(to.geography, to.boundaryRelease, target.code);
		if (!child || !parent) {
			throw new Error(
				`${crosswalkId}: geometry is missing for ${!child ? `${from.geography}/${from.boundaryRelease}/${record.source.code}` : `${to.geography}/${to.boundaryRelease}/${target.code}`}.`,
			);
		}
		for (const ring of ringsOf(child)) {
			for (const vertex of ring) {
				testedVertexCount += 1;
				const containment = containPoint(vertex, parent);
				if (containment === "outside") {
					const outsideM = boundaryDistanceWithinM(
						vertex,
						parent,
						CONTAINMENT_TOLERANCE_M,
					);
					if (outsideM === undefined)
						throw new Error(
							`${crosswalkId}: ${record.source.code} has a vertex more than ${CONTAINMENT_TOLERANCE_M} m outside declared parent ${target.code}.`,
						);
					toleratedVertexCount += 1;
					widestOutsideM = Math.max(widestOutsideM, outsideM);
				}
				if (containment === "boundary") boundaryVertexCount += 1;
			}
		}
	}
	return {
		status: "verified",
		sourceAreaCount: records.length,
		testedVertexCount,
		boundaryVertexCount,
		toleranceM: CONTAINMENT_TOLERANCE_M,
		toleratedVertexCount,
		widestOutsideM: Math.round(widestOutsideM * 10) / 10,
	};
};
