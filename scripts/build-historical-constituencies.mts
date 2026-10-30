/**
 * Writes the historical constituency releases: one per boundary set from 1918
 * to 2005, each a GeoJSON of the House of Commons Library's constituencies
 * with no geometry. No boundaries are published for these eras, but results
 * keyed by them need areas to sit on.
 *
 * The Library numbers constituencies within each boundary set, so `1` is
 * Battersea North in 1918 and Aberavon in 1955. A code is the set's first
 * year and the Library's id (`1918-1`), unique across sets. A few 1918 Irish
 * rows have no id; the compiler keys those by name, and so does the code.
 *
 * Usage: node --import tsx scripts/build-historical-constituencies.mts [out]
 * `out` defaults to data/source/boundaries/historical-constituency.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadHistoricalGeneralElection } from "@uk-data-atlas/datasets/data/historical-general-election/loader";
import { historicalConstituencyCode } from "@uk-data-atlas/datasets/data/historical-general-election/constituencies";

const root = join(import.meta.dirname, "..");
const out =
	process.argv[2] ??
	join(root, "data/source/boundaries/historical-constituency");
const sourceDirectory = join(
	root,
	"data/source/politics/elections/general-elections/1918-2019",
);
const source = JSON.parse(
	readFileSync(join(sourceDirectory, "meta.json"), "utf8"),
);

const elections = await loadHistoricalGeneralElection(async (path) =>
	readFileSync(join(root, "data/source", path), "utf8"),
);

// Boundary sets in election order, each with its constituencies in the order
// first published and the name its latest election gives them.
const sets = new Map<string, Map<string, string>>();
for (const election of Object.values(elections).sort(
	(a, b) => a.year - b.year || a.election.localeCompare(b.election),
)) {
	// From 2010 the Library uses ONS codes, on the atlas's own releases.
	if (election.boundarySet.startsWith("2010")) continue;
	let names = sets.get(election.boundarySet);
	if (!names) sets.set(election.boundarySet, (names = new Map()));
	for (const [id, { constituencyName }] of Object.entries(election.data))
		names.set(id, constituencyName);
}

for (const [set, names] of sets) {
	const [first, last = first] = set.split("-");
	const release = `${first}-uk`;
	const directory = join(out, release);
	mkdirSync(directory, { recursive: true });
	const geojson = `${JSON.stringify({
		type: "FeatureCollection",
		features: [...names].map(([id, name]) => ({
			type: "Feature",
			geometry: null,
			properties: {
				PCONHCD: historicalConstituencyCode(set, id),
				PCONHNM: name,
				LIBRARYID: id,
			},
		})),
	})}\n`;
	writeFileSync(join(directory, "source.geojson"), geojson);
	const span = first === last ? first : `${first} to ${last}`;
	writeFileSync(
		join(directory, "meta.json"),
		`${JSON.stringify(
			{
				id: release,
				kind: "boundary",
				title: `Westminster constituencies, ${span} (names and House of Commons Library ids)`,
				description: `The constituencies of the general elections held on the ${set} boundaries, as the House of Commons Library numbers them. No boundaries are published for them, so each feature has no geometry.`,
				topics: ["boundaries", "geography", "elections", "history"],
				publisher: source.publisher,
				sourceUrl: source.sourceUrl,
				retrieved: "2026-10-30",
				temporalCoverage: first === last ? first : `${first}/${last}`,
				spatialCoverage: {
					geography: "historicalConstituency",
					countries: source.spatialCoverage.countries,
				},
				licence: source.licence,
				attribution: source.publisher,
				files: [
					{
						path: "source.geojson",
						role: "source",
						sha256: createHash("sha256")
							.update(geojson)
							.digest("hex"),
						note: `Written by scripts/build-historical-constituencies.mts from the Library's 1918-2019election_results.csv: ${names.size} constituencies with no geometry, each named as at the set's latest election.`,
					},
				],
			},
			null,
			"\t",
		)}\n`,
	);
	console.log(`${release}: ${names.size} constituencies (${set})`);
}
