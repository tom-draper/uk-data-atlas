import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AreaGeometryCache, type GeometrySourceLookup } from "./areaGeometry";
import { containPoint, ringsOf } from "./areaContainment";
import { boundaryDistanceWithinM, distanceToBoundaryM } from "./areaDistance";
import type { CrosswalkArea } from "./crosswalkInventory";
import { releaseKey } from "./geographyKeys";

export type GeometryContainmentValidation =
	| {
			status: "checked";
			sourceAreaCount: number;
			testedVertexCount: number;
			boundaryVertexCount: number;
			/** How far outside its parent a vertex may lie and still be within. */
			toleranceM: number;
			/** Vertices outside their parent, but within the tolerance of it. */
			toleratedVertexCount: number;
			/** Vertices beyond tolerance, grouped by source area at its furthest point. */
			outsideToleranceAreas: Array<{
				code: string;
				parent: string;
				outsideM: number;
			}>;
			/** Geometry inputs and correction definitions used by this check. */
			geometryInputs: GeometryContainmentInputs;
			/** The furthest any outside vertex lies beyond its parent. */
			widestOutsideM: number;
	  }
	| { status: "not-available"; reason: string };

export type GeometryContainmentInputs = Array<{
	side: "from" | "to";
	geography: string;
	boundaryRelease: string;
	input: string;
	inputHash: string | null;
	crs: string;
	codeProperty: string;
	corrections: Array<{ id: string; contentHash: string }>;
}>;

const sha256 = (content: Buffer | string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

export const geometryContainmentInputs = (
	repositoryRoot: string,
	geometrySources: GeometrySourceLookup,
	from: { geography: string; boundaryRelease: string },
	to: { geography: string; boundaryRelease: string },
): GeometryContainmentInputs =>
	(["from", "to"] as const).map((side) => {
		const endpoint = side === "from" ? from : to;
		const source = geometrySources.get(
			releaseKey(endpoint.geography, endpoint.boundaryRelease),
		)!;
		return {
			side,
			geography: endpoint.geography,
			boundaryRelease: endpoint.boundaryRelease,
			input: source.input,
			inputHash: source.inputHash ?? null,
			crs: source.crs,
			codeProperty: source.codeProperty,
			corrections: (source.corrections ?? []).map((id) => ({
				id,
				contentHash: sha256(
					readFileSync(
						join(
							repositoryRoot,
							"data",
							"boundaries",
							`${id}.json`,
						),
					),
				),
			})),
		};
	});

/**
 * How far outside its declared parent a child's vertex may lie. Generalised
 * boundaries are simplified separately for each geography, so a shared edge
 * does not coincide exactly: an exact test fails on noise of a metre or two.
 * Match the 100 m sliver width used by the other geometry-derived crosswalks.
 */
export const CONTAINMENT_TOLERANCE_M = 100;

const outsideDistanceM = (
	point: [number, number],
	geometry: Parameters<typeof distanceToBoundaryM>[1],
) => {
	for (const radius of [
		200, 500, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000,
	]) {
		const distance = boundaryDistanceWithinM(point, geometry, radius);
		if (distance !== undefined) return distance;
	}
	return distanceToBoundaryM(point, geometry);
};

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
	geometryCache?: AreaGeometryCache,
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
	const cache =
		geometryCache ??
		new AreaGeometryCache(repositoryRoot, geometrySources, 2);
	let testedVertexCount = 0;
	let boundaryVertexCount = 0;
	let toleratedVertexCount = 0;
	let widestOutsideM = 0;
	const outsideToleranceAreas = new Map<
		string,
		{ code: string; parent: string; outsideM: number }
	>();
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
					const outsideM = outsideDistanceM(vertex, parent);
					widestOutsideM = Math.max(widestOutsideM, outsideM);
					if (outsideM <= CONTAINMENT_TOLERANCE_M) {
						toleratedVertexCount += 1;
					} else {
						const key = `${record.source.code}/${target.code}`;
						const previous = outsideToleranceAreas.get(key);
						outsideToleranceAreas.set(key, {
							code: record.source.code,
							parent: target.code,
							outsideM: Math.max(
								previous?.outsideM ?? 0,
								outsideM,
							),
						});
					}
				}
				if (containment === "boundary") boundaryVertexCount += 1;
			}
		}
	}
	return {
		status: "checked",
		sourceAreaCount: records.length,
		testedVertexCount,
		boundaryVertexCount,
		toleranceM: CONTAINMENT_TOLERANCE_M,
		toleratedVertexCount,
		outsideToleranceAreas: [...outsideToleranceAreas.values()].sort(
			(left, right) => left.code.localeCompare(right.code),
		),
		geometryInputs: geometryContainmentInputs(
			repositoryRoot,
			geometrySources,
			from,
			to,
		),
		widestOutsideM: Math.round(widestOutsideM * 10) / 10,
	};
};
