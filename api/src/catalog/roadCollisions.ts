import { readFileSync } from "node:fs";
import { countryForCode } from "./countries";
import { type Indicator, publishIndicators } from "./indicators";
import type { CatalogManifest, CompiledMeasure } from "./manifest";
import { sha256 } from "./values";

/** Final annual reported road collisions, by local authority and by LSOA. */
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
	const roadCollisionsEditions = Object.values(
		JSON.parse(readFileSync(roadCollisionsPath, "utf8")) as Record<
			string,
			{
				year: number;
				boundaryYear: number;
				excluded?: Array<{ code: string; collisions: number }>;
				withoutLsoa?: Record<string, number>;
			}
		>,
	).sort((left, right) => left.year - right.year);
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
		"Final annual reported personal injury collisions in Great Britain. The Department for Transport may make occasional revisions to historic open-data files; each Atlas release pins the exact source artifact it used.",
		"Each collision is counted in the area the Department for Transport assigns it to in the published record, not by placing its coordinates in a boundary.",
		"These count collisions reported to the police, not casualties or unreported collisions.",
	];
	const mergeSourcePeriods = (entries: CompiledMeasure[]) => [
		...entries
			.reduce((merged, entry) => {
				const source = entry.measure.sources[0]!;
				const key = `${entry.measure.id}/${source.sourceGeography.type}/${source.sourceGeography.boundaryYear}`;
				const previous = merged.get(key);
				if (!previous) {
					merged.set(key, entry);
					return merged;
				}
				const previousSource = previous.measure.sources[0]!;
				previous.measure.sources[0] = {
					...previousSource,
					periods: [
						...previousSource.periods,
						...source.periods,
					].sort(),
					// Catalog coverage describes the latest period, whereas the
					// artifact preserves all periods for a comparison.
					coverage: source.coverage,
				};
				previous.artifact.periods = [
					...previous.artifact.periods,
					...entry.artifact.periods,
				].sort((left, right) =>
					left.period.localeCompare(right.period),
				);
				previous.artifact.contentHash = sha256(
					JSON.stringify({
						schemaVersion: previous.artifact.schemaVersion,
						measureId: previous.artifact.measureId,
						sourceGeography: previous.artifact.sourceGeography,
						periods: previous.artifact.periods,
					}),
				);
				return merged;
			}, new Map<string, CompiledMeasure>())
			.values(),
	];
	for (const roadCollisionsEdition of roadCollisionsEditions) {
		const period = String(roadCollisionsEdition.year);
		compiled.push(
			...publishIndicators(manifest, {
				datasetId: "road-collisions",
				path: roadCollisionsPath,
				boundaryYear: roadCollisionsEdition.boundaryYear,
				period,
				sourcePeriod: period,
				artifactStem: `local-authority-${roadCollisionsEdition.boundaryYear}`,
				expectedCodes:
					roadCollisionsEdition.boundaryYear === 2024
						? [...populationCodes].filter(
								(code) => countryForCode(code) !== "GB-NIR",
							)
						: undefined,
				coverageNote: [
					"Published for Great Britain; Northern Ireland's collisions are recorded separately and are not in this file.",
					...(roadCollisionsEdition.excluded ?? []).map(
						({ code, collisions: count }) =>
							`${collisionCount(count)} assigned to ${code}, which is not a local authority code, ${count === 1 ? "is" : "are"} not counted in any authority.`,
					),
					"An authority with no collision records has no value rather than zero, since the source cannot distinguish no recorded collision from an unreported one.",
				].join(" "),
				notes: roadCollisionNotes,
				indicators: roadCollisionIndicators,
			}),
		);
		compiled.push(
			...publishIndicators(manifest, {
				datasetId: "road-collisions",
				path: roadCollisionsPath,
				boundaryYear: roadCollisionsEdition.boundaryYear,
				geography: "lsoa",
				partitionBoundaryYear: 2021,
				table: "lsoas",
				artifactStem: "lsoa-2021",
				period,
				sourcePeriod: period,
				coverageNote: [
					"Published for England and Wales on December 2021 LSOAs. Scotland has no LSOAs and is not in this partition.",
					"An LSOA with no collision records has no value rather than zero, since the source cannot distinguish no recorded collision from an unreported one.",
				].join(" "),
				notes: roadCollisionNotes,
				indicators: roadCollisionIndicators,
			}),
		);
	}
	return mergeSourcePeriods(compiled);
};
