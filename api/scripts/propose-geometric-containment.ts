import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AreaInventory } from "../src/areaInventory";
import type { BoundaryRegistry } from "../src/boundaryRegistry";
import type { GeometricContainmentCrosswalkAdapter } from "../src/crosswalkAdapters";
import type { CrosswalkInventory } from "../src/crosswalkInventory";
import type { readGeometries as readGeometriesForCache } from "../src/areaOverlap";
import { measureContainment } from "../src/geometricContainment";
import { readGeometrySourceLookup } from "../src/geometrySources";

// The sliver width the area-overlap crosswalks use, so every method here
// agrees on what counts as two borders generalised apart.
const SLIVER_WIDTH_M = 100;

// A pair that is not a hierarchy shows it within a handful of areas.
const ABANDON_AFTER = 5;

// A child of one decade rarely nests in a parent of another, and testing it
// costs as much as testing a pair that might.
const MAXIMUM_VINTAGE_GAP_YEARS = 3;

/**
 * Clipping every child against a whole country costs a quarter of an hour a
 * pair, for a relationship a release's declared coverage and its areas' code
 * prefixes already imply. Country membership is left to a published lookup,
 * such as the local authority one, and to the paths composed through it.
 */
const SKIPPED_PARENTS = ["country"];

const toKebabCase = (value: string) =>
	value.replaceAll(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

type Release = {
	geography: string;
	id: string;
	identity: string;
	year: number;
	countries: string[];
	areaCount: number;
};

/**
 * Search for hierarchies that geometry establishes and no lookup carries.
 *
 * Candidates are pairs where one release could nest in another: it has more
 * areas, its countries are covered by the other, their vintages are close,
 * and nothing already relates them. Of the releases of one parent geography
 * only the nearest in vintage is asked, since the rest would repeat the same
 * question, and one side must be a release nothing relates yet, which is what
 * this search is for. Each candidate is measured, and the ones where every
 * child sits within one parent are proposed as adapters. The geometry
 * decides; this only chooses what to ask.
 */
export const proposeGeometricContainment = (
	repositoryRoot: string,
	{
		only,
		report,
	}: {
		only?: (pair: { from: Release; to: Release }) => boolean;
		/** Called as each candidate is settled, for progress on a long sweep. */
		report?: (line: string) => void;
	} = {},
) => {
	const directory = join(repositoryRoot, "api", "public");
	const read = <T>(path: string) =>
		JSON.parse(readFileSync(join(directory, path), "utf8")) as T;
	const geometrySources = readGeometrySourceLookup(
		join(repositoryRoot, "api"),
	);
	const areaCounts = new Map(
		read<AreaInventory>("area-inventory.json")
			.releases.filter((release) => release.status === "available")
			.map((release) => [
				`${release.geography}/${release.id}`,
				release.recordCount,
			]),
	);
	const related = new Set(
		read<CrosswalkInventory>("crosswalk-inventory.json").crosswalks.flatMap(
			(crosswalk) => {
				const from = `${crosswalk.from.geography}/${crosswalk.from.boundaryRelease}`;
				const to = `${crosswalk.to.geography}/${crosswalk.to.boundaryRelease}`;
				return [`${from}|${to}`, `${to}|${from}`];
			},
		),
	);
	const releases: Release[] = read<BoundaryRegistry>(
		"boundary-releases.json",
	).releases.flatMap((release) => {
		const identity = `${release.geography}/${release.id}`;
		const areaCount = areaCounts.get(identity);
		return geometrySources.has(identity) && areaCount !== undefined
			? [
					{
						geography: release.geography,
						id: release.id,
						identity,
						year: Number(release.id.slice(0, 4)),
						countries: release.coverage.countries,
						areaCount,
					},
				]
			: [];
	});
	const stranded = new Set(
		releases
			.filter(
				(release) =>
					![...related].some((pair) =>
						pair.startsWith(`${release.identity}|`),
					),
			)
			.map((release) => release.identity),
	);
	const candidates = releases.flatMap((from) => {
		const nearest = new Map<string, Release>();
		for (const to of releases) {
			if (
				from.geography === to.geography ||
				SKIPPED_PARENTS.includes(to.geography) ||
				from.areaCount <= to.areaCount ||
				Math.abs(from.year - to.year) > MAXIMUM_VINTAGE_GAP_YEARS ||
				!from.countries.every((country) =>
					to.countries.includes(country),
				) ||
				related.has(`${from.identity}|${to.identity}`) ||
				!(stranded.has(from.identity) || stranded.has(to.identity)) ||
				(only && !only({ from, to }))
			)
				continue;
			const held = nearest.get(to.geography);
			const closer =
				!held ||
				Math.abs(from.year - to.year) <
					Math.abs(from.year - held.year) ||
				(Math.abs(from.year - to.year) ===
					Math.abs(from.year - held.year) &&
					to.id.localeCompare(held.id) > 0);
			if (closer) nearest.set(to.geography, to);
		}
		return [...nearest.values()]
			.sort((left, right) => left.identity.localeCompare(right.identity))
			.map((to) => ({ from, to }));
	});
	// Coarsest child first. Once a parent is reached, a finer child of the
	// same parent is left to composition through the coarser one, which the
	// relationship path search does: LSOAs reach a police force area through
	// their local authority. A child nothing relates yet is always asked,
	// because composition needs it to reach anything at all.
	candidates.sort(
		(left, right) =>
			left.from.areaCount - right.from.areaCount ||
			left.from.identity.localeCompare(right.from.identity) ||
			left.to.identity.localeCompare(right.to.identity),
	);
	const reached = new Set<string>();
	const adapters: GeometricContainmentCrosswalkAdapter[] = [];
	const rejected: string[] = [];
	// Candidates are grouped by child, so holding the two releases a candidate
	// needs saves reading the child again for each parent it is asked about.
	// A release is hundreds of megabytes parsed, so nothing else is kept.
	const geometryCache = new Map<
		string,
		ReturnType<typeof readGeometriesForCache>
	>();
	for (const [index, { from, to }] of candidates.entries()) {
		if (reached.has(to.identity) && !stranded.has(from.identity)) {
			report?.(
				`[${index + 1}/${candidates.length}] ${from.identity} -> ${to.identity}: left to composition through a coarser child`,
			);
			continue;
		}
		const started = Date.now();
		for (const key of geometryCache.keys())
			if (key !== from.identity && key !== to.identity)
				geometryCache.delete(key);
		const id = `${toKebabCase(from.geography)}-${from.id}-to-${toKebabCase(to.geography)}-${to.id}-geometric-containment`;
		let measured;
		try {
			measured = measureContainment(
				repositoryRoot,
				id,
				{ geography: from.geography, boundaryRelease: from.id },
				{ geography: to.geography, boundaryRelease: to.id },
				geometrySources,
				SLIVER_WIDTH_M,
				ABANDON_AFTER,
				geometryCache,
			);
		} catch (error) {
			// A release the compiler cannot read at all, such as a
			// names-and-codes file holding no shapes, is not a candidate.
			const reason =
				error instanceof Error ? error.message : String(error);
			report?.(
				`[${index + 1}/${candidates.length}] ${from.identity} -> ${to.identity}: unmeasurable`,
			);
			rejected.push(`${from.identity} -> ${to.identity}: ${reason}`);
			continue;
		}
		const refused = measured.areas.filter(
			(area) => area.relation !== "within",
		);
		if (refused.length === 0) reached.add(to.identity);
		report?.(
			`[${index + 1}/${candidates.length}] ${from.identity} -> ${to.identity}: ${
				refused.length === 0
					? `within (${measured.areas.length} areas)`
					: `no (${refused[0]!.code} ${refused[0]!.relation})`
			}, ${Math.round((Date.now() - started) / 1000)} s`,
		);
		if (refused.length > 0) {
			rejected.push(
				`${from.identity} -> ${to.identity}: ${refused.length} of ${measured.areas.length} measured are not within one parent (${refused
					.slice(0, 3)
					.map((area) => `${area.code} ${area.relation}`)
					.join(", ")})`,
			);
			continue;
		}
		adapters.push({
			id,
			method: "geometric-containment",
			quality: "derived",
			relationshipPurpose: "membership",
			weighting: { status: "not-applicable" },
			from: { geography: from.geography, boundaryRelease: from.id },
			to: { geography: to.geography, boundaryRelease: to.id },
			sliverWidthM: SLIVER_WIDTH_M,
		});
	}
	return { adapters, rejected, candidateCount: candidates.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const geographies = process.argv
		.filter((argument) => argument.startsWith("--from="))
		.flatMap((argument) => argument.slice("--from=".length).split(","));
	const { adapters, rejected, candidateCount } = proposeGeometricContainment(
		repositoryRoot,
		{
			...(geographies.length > 0
				? {
						only: ({ from }: { from: Release }) =>
							geographies.includes(from.geography),
					}
				: {}),
			report: (line: string) => console.log(line),
		},
	);
	for (const reason of rejected) console.log(`No: ${reason}`);
	for (const adapter of adapters)
		console.log(
			`Yes: ${adapter.from.geography}/${adapter.from.boundaryRelease} -> ${adapter.to.geography}/${adapter.to.boundaryRelease}`,
		);
	console.log(
		`${adapters.length} containments of ${candidateCount} candidates.`,
	);
	if (process.argv.includes("--write")) {
		const path = join(
			repositoryRoot,
			"api",
			"config",
			"crosswalk-adapters.json",
		);
		const file = JSON.parse(readFileSync(path, "utf8")) as {
			schemaVersion: 1;
			crosswalks: Array<{ id: string; method: string }>;
		};
		const kept = file.crosswalks.filter(
			(adapter) =>
				adapter.method !== "geometric-containment" ||
				!adapters.some((candidate) => candidate.id === adapter.id),
		);
		file.crosswalks = [...kept, ...adapters];
		writeFileSync(path, `${JSON.stringify(file, null, "\t")}\n`);
		console.log(`Wrote ${adapters.length} adapters to ${path}`);
	}
}
