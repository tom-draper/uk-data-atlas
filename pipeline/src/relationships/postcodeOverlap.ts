import { sha256 } from "@uk-data-atlas/artifacts";
import type { AreaLookup } from "@uk-data-atlas/areas";
import type { GeometrySourceLookup } from "@uk-data-atlas/geometry";
import { releaseKey } from "@uk-data-atlas/geography";
import {
	validateEndpoint,
	type PostcodeOverlapCrosswalkAdapter,
	type PostcodeOverlapCrosswalkArtifact,
} from "@uk-data-atlas/atlas-runtime/relationships";
import { join } from "node:path";
import { labelsFor, round } from "../geographies/areaOverlap.ts";
import { MEASURES } from "../crosswalk-weights/atoms.ts";
import { readPlacement } from "../crosswalk-weights/placements.ts";
import {
	readStoredAtoms,
	weightAtomsDirectory,
} from "../crosswalk-weights/storedAtoms.ts";
import { pairTotals } from "../crosswalk-weights/weigh.ts";

/** Northern Ireland has no postcodes in the directory the atoms come from. */
export const NORTHERN_IRELAND_REASON =
	"no postcodes in ONSPD for Northern Ireland";
const NO_RESIDENTS_REASON = "no residents placed in the source";
const NO_TARGET_REASON = "no pair holds the source's residents";

const COUNT = MEASURES.length;
const POPULATION = MEASURES.indexOf("population");

const sum = (values: Iterable<number>) => {
	let total = 0;
	for (const value of values) total += value;
	return total;
};

/**
 * Compile a conversion crosswalk from the atoms placed in two releases.
 *
 * Every pair of areas with an atom in both is a candidate edge. A pair is
 * dropped when it holds less than `minimumShare` of its source's measure on
 * every basis (postcodes, residents, households, dwellings), the same rule for
 * every crosswalk, so a ward does not list a constituency for the stray
 * postcodes where generalised borders disagree. What is kept is renormalised:
 * a source's weights, which are shares of its residents, sum to 1 over its
 * kept targets, and its `coverage` says how much of its people they hold.
 *
 * The atoms and their placements are the `weight-atoms` stage's. A source
 * with no residents has no targets, as does one with no atoms.
 */
export const compilePostcodeOverlapCrosswalk = (
	repositoryRoot: string,
	adapter: PostcodeOverlapCrosswalkAdapter,
	geometrySources: GeometrySourceLookup,
	areaLookup: AreaLookup | undefined,
): PostcodeOverlapCrosswalkArtifact => {
	const atoms = readStoredAtoms(repositoryRoot);
	const directory = join(weightAtomsDirectory(repositoryRoot), "placements");
	const side = (endpoint: PostcodeOverlapCrosswalkAdapter["from"]) => {
		const geometryInput = geometrySources.get(
			releaseKey(endpoint.geography, endpoint.boundaryRelease),
		)?.inputHash;
		if (geometryInput === undefined)
			throw new Error(
				`${adapter.id}: ${endpoint.geography}/${endpoint.boundaryRelease} has no geometry to place postcodes in.`,
			);
		const placement = readPlacement(
			[directory],
			endpoint.geography,
			endpoint.boundaryRelease,
			{ atomsKey: atoms.key, geometryInput },
		);
		if (!placement)
			throw new Error(
				`${adapter.id}: the atoms are not placed in ${endpoint.geography}/${endpoint.boundaryRelease}: rebuild weight-atoms.`,
			);
		return { placement, geometryInput };
	};
	const from = side(adapter.from);
	const to = side(adapter.to);
	const { sources, targets, pairs, width } = pairTotals(
		atoms.measures,
		from.placement,
		to.placement,
	);
	const { minimumShare } = adapter.weighting;
	// Pairs by source, then target: the keys sort that way.
	const bySource = new Map<number, Array<[number, Float64Array]>>();
	for (const key of [...pairs.keys()].sort((a, b) => a - b)) {
		const a = Math.floor(key / width);
		const list = bySource.get(a) ?? [];
		list.push([key - a * width, pairs.get(key)!]);
		bySource.set(a, list);
	}
	let keptPairs = 0;
	let droppedPairs = 0;
	let droppedPeople = 0;
	let allPeople = 0;
	let unplacedPeople = 0;
	const unplaced = new Map<string, number>();
	let minimumCoverage = 1;
	const referenced = new Set<string>();
	const records = from.placement.codes.map((code, a) => {
		const people = sources[a * COUNT + POPULATION]!;
		const candidates = bySource.get(a) ?? [];
		const kept = candidates.filter(([, pair]) =>
			MEASURES.some((_, m) => {
				const total = sources[a * COUNT + m]!;
				return total > 0 && pair[m]! / total >= minimumShare;
			}),
		);
		const peopleInKept = kept.reduce(
			(sum, [, pair]) => sum + pair[POPULATION]!,
			0,
		);
		const inPairs = candidates.reduce(
			(sum, [, pair]) => sum + pair[POPULATION]!,
			0,
		);
		allPeople += people;
		unplacedPeople += people - inPairs;
		droppedPairs += candidates.length - kept.length;
		const usable = people > 0 && peopleInKept > 0;
		if (usable) {
			keptPairs += kept.length;
			droppedPeople += inPairs - peopleInKept;
			minimumCoverage = Math.min(minimumCoverage, peopleInKept / people);
		} else {
			const reason =
				people > 0
					? NO_TARGET_REASON
					: code.startsWith("N")
						? NORTHERN_IRELAND_REASON
						: NO_RESIDENTS_REASON;
			unplaced.set(reason, (unplaced.get(reason) ?? 0) + 1);
		}
		return {
			source: {
				code,
				labels: labelsFor(adapter.id, areaLookup, adapter.from, code),
				population: round(people, 3),
				coverage: usable ? round(peopleInKept / people, 8) : 0,
			},
			targets: usable
				? kept.map(([b, pair]) => {
						const target = to.placement.codes[b]!;
						referenced.add(target);
						return {
							code: target,
							labels: labelsFor(
								adapter.id,
								areaLookup,
								adapter.to,
								target,
							),
							weight: round(pair[POPULATION]! / peopleInKept, 10),
							population: round(pair[POPULATION]!, 3),
							sourceShare: round(pair[POPULATION]! / people, 8),
							targetShare: round(
								pair[POPULATION]! /
									targets[b * COUNT + POPULATION]!,
								8,
							),
						};
					})
				: [],
		};
	});
	const artifactWithoutHash = {
		schemaVersion: 1 as const,
		id: adapter.id,
		method: adapter.method,
		quality: adapter.quality,
		weighting: adapter.weighting,
		from: {
			geography: adapter.from.geography,
			boundaryRelease: adapter.from.boundaryRelease,
		},
		to: {
			geography: adapter.to.geography,
			boundaryRelease: adapter.to.boundaryRelease,
		},
		provenance: {
			atoms: {
				key: atoms.key,
				postcodes: atoms.postcodes,
				outputAreas: atoms.outputAreas,
			},
			inputs: [
				{
					side: "from" as const,
					geography: adapter.from.geography,
					boundaryRelease: adapter.from.boundaryRelease,
					geometryInput: from.geometryInput,
				},
				{
					side: "to" as const,
					geography: adapter.to.geography,
					boundaryRelease: adapter.to.boundaryRelease,
					geometryInput: to.geometryInput,
				},
			],
		},
		validation: {
			sourceNameConflicts: [],
			endpoints: {
				from: validateEndpoint(
					adapter.id,
					"from",
					adapter.from,
					new Set(records.map((record) => record.source.code)),
					areaLookup,
				),
				to: validateEndpoint(
					adapter.id,
					"to",
					adapter.to,
					referenced,
					areaLookup,
				),
			},
			overlap: {
				minimumShare,
				postcodeCount: atoms.postcodes,
				outputAreaCount: atoms.outputAreas,
				pairCount: pairs.size,
				keptPairCount: keptPairs,
				droppedPairCount: droppedPairs,
				droppedPopulationShare: round(
					allPeople > 0 ? droppedPeople / allPeople : 0,
					8,
				),
				unplacedPopulationShare: round(
					allPeople > 0 ? unplacedPeople / allPeople : 0,
					8,
				),
				minimumSourceCoverage: round(minimumCoverage, 8),
			},
			coverage: {
				sourceCount: records.length,
				placedSources: records.length - sum(unplaced.values()),
				unplacedSources: sum(unplaced.values()),
				unplacedReasons: [...unplaced]
					.map(([reason, count]) => ({ reason, count }))
					.sort((a, b) => a.reason.localeCompare(b.reason)),
			},
		},
		records,
	};
	return {
		...artifactWithoutHash,
		contentHash: sha256(JSON.stringify(artifactWithoutHash)),
	};
};
