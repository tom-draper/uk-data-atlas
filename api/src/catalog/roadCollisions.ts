import { readFileSync } from "node:fs";
import { countryForCode } from "./countries";
import { type Indicator, publishIndicators } from "./indicators";
import type { CatalogManifest, CompiledMeasure } from "./manifest";

/** Provisional reported road collisions, by local authority and by LSOA. */
export const compileRoadCollisions = (
	manifest: CatalogManifest,
	roadCollisionsPath: string,
	populationCodes: Set<string>,
): CompiledMeasure[] => {
	const compiled: CompiledMeasure[] = [];
	const collisions = (
		id: string,
		label: string,
		field: string,
		note: string,
	): Indicator => ({
		id,
		label,
		field,
		valueKind: "count",
		unit: "reported collisions",
		aggregation: { kind: "extensive", operation: "sum", available: true },
		notes: [note],
	});
	const roadCollisionsEdition = Object.values(
		JSON.parse(readFileSync(roadCollisionsPath, "utf8")) as Record<
			string,
			{
				excluded?: Array<{ code: string; collisions: number }>;
				withoutLsoa?: Record<string, number>;
			}
		>,
	)[0];
	const collisionCount = (count: number) =>
		`${count} collision${count === 1 ? "" : "s"}`;
	const roadCollisionIndicators = [
		collisions(
			"road-collisions",
			"Reported road collisions",
			"collisions",
			"Every reported collision, whatever its severity.",
		),
		collisions(
			"road-collisions-fatal",
			"Fatal road collisions",
			"fatal",
			"Collisions in which someone died within 30 days, a subset of all reported collisions.",
		),
		collisions(
			"road-collisions-serious",
			"Serious road collisions",
			"serious",
			"Collisions whose most severe injury the police recorded as serious. Forces record injuries through two different systems, so this share varies by force as well as by collision; the Department for Transport publishes adjusted estimates for comparisons between forces, which are not served here.",
		),
		collisions(
			"road-collisions-slight",
			"Slight road collisions",
			"slight",
			"Collisions whose most severe injury the police recorded as slight, with the same caveat about recording systems as serious collisions.",
		),
	];
	const roadCollisionNotes = [
		"Provisional reported personal injury collisions from January to June 2025, a half year, which the Department for Transport revises before its final annual release. The period 2025-H1 is not comparable with a full year.",
		"Each collision is counted in the area the Department for Transport assigns it to in the published record, not by placing its coordinates in a boundary.",
		"These count collisions reported to the police, not casualties or unreported collisions.",
	];
	compiled.push(
		...publishIndicators(manifest, {
			datasetId: "road-collisions",
			path: roadCollisionsPath,
			boundaryYear: 2024,
			period: "2025-H1",
			expectedCodes: [...populationCodes].filter(
				(code) => countryForCode(code) !== "GB-NIR",
			),
			coverageNote: [
				"Published for Great Britain; Northern Ireland's collisions are recorded separately and are not in this file.",
				...(roadCollisionsEdition?.excluded ?? []).map(
					({ code, collisions: count }) =>
						`${collisionCount(count)} assigned to ${code}, which is not a local authority code, ${count === 1 ? "is" : "are"} not counted in any authority.`,
				),
				"An authority with no collision records has no value rather than zero, since its collisions may not yet have been reported.",
			].join(" "),
			notes: roadCollisionNotes,
			indicators: roadCollisionIndicators,
		}),
	);
	const scottishWithoutLsoa =
		roadCollisionsEdition?.withoutLsoa?.["GB-SCT"] ?? 0;
	const otherWithoutLsoa = Object.entries(
		roadCollisionsEdition?.withoutLsoa ?? {},
	)
		.filter(([nation]) => nation !== "GB-SCT")
		.reduce((total, [, count]) => total + count, 0);
	compiled.push(
		...publishIndicators(manifest, {
			datasetId: "road-collisions",
			path: roadCollisionsPath,
			boundaryYear: 2024,
			geography: "lsoa",
			partitionBoundaryYear: 2021,
			table: "lsoas",
			artifactStem: "lsoa-2021",
			period: "2025-H1",
			coverageNote: [
				`Published for England and Wales on December 2021 LSOAs. Scotland has no LSOAs, so its ${collisionCount(scottishWithoutLsoa)} are not in this partition.`,
				...(otherWithoutLsoa > 0
					? [
							`${collisionCount(otherWithoutLsoa)} in England and Wales ${otherWithoutLsoa === 1 ? "has" : "have"} no LSOA code and ${otherWithoutLsoa === 1 ? "is" : "are"} not counted.`,
						]
					: []),
				"An LSOA with no collision records has no value rather than zero: most had none, but a provisional file cannot tell that apart from collisions not yet reported.",
			].join(" "),
			notes: roadCollisionNotes,
			indicators: roadCollisionIndicators,
		}),
	);
	return compiled;
};
