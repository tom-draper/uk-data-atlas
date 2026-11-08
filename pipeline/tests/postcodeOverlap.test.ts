import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import type { AreaLookup } from "@uk-data-atlas/areas";
import type { GeometrySourceLookup } from "@uk-data-atlas/atlas-runtime/geometry";
import type { PostcodeOverlapCrosswalkAdapter } from "@uk-data-atlas/atlas-runtime/relationships";
import { compilePostcodeOverlapCrosswalk } from "../src/relationships/postcodeOverlap";
import { MEASURES, type WeightAtoms } from "../src/crosswalk-weights/atoms";
import {
	placementFile,
	placementKey,
} from "../src/crosswalk-weights/placements";
import {
	weightAtomsDirectory,
	writeStoredAtoms,
} from "../src/crosswalk-weights/storedAtoms";

const adapter = (minimumShare: number): PostcodeOverlapCrosswalkAdapter => ({
	id: "ward-to-constituency-postcode-overlap",
	method: "postcode-overlap",
	quality: "derived",
	weighting: {
		status: "provided",
		basis: "population",
		normalisation: "per-source",
		population: "Census 2021 usual residents",
		date: "2021-03-21",
		minimumShare,
	},
	from: { geography: "ward", boundaryRelease: "2024" },
	to: { geography: "constituency", boundaryRelease: "2024" },
});

/**
 * Ten atoms of 10 people each (and one postcode each, plus 2 households and 3
 * dwellings), placed in wards A, B, C and constituencies X, Y, Z:
 *   A: atoms 0-5, in X (0-3) and Y (4-5)   B: atoms 6-8, all in Y
 *   C: atom 9, in Z                         one atom of A is in no constituency
 */
const fixture = (context: { onTestFinished: (run: () => void) => void }) => {
	const root = mkdtempSync(join(tmpdir(), "postcode-overlap-"));
	context.onTestFinished(() =>
		rmSync(root, { recursive: true, force: true }),
	);
	const count = 10;
	const atoms: WeightAtoms = {
		count,
		postcodes: count,
		longitude: new Float64Array(count),
		latitude: new Float64Array(count).map((_, at) => at),
		measures: {
			postcodes: new Float64Array(count).fill(1),
			population: new Float64Array(count).fill(10),
			households: new Float64Array(count).fill(2),
			dwellings: new Float64Array(count).fill(3),
		},
		totals: Object.fromEntries(
			MEASURES.map((name) => [name, { held: 0, allocated: 0 }]),
		) as WeightAtoms["totals"],
	};
	writeStoredAtoms(root, atoms);
	const key = JSON.parse(
		readFileSync(join(weightAtomsDirectory(root), "atoms.json"), "utf8"),
	).key as string;
	const directory = join(weightAtomsDirectory(root), "placements");
	mkdirSync(directory, { recursive: true });
	const place = (
		geography: string,
		codes: string[],
		area: number[],
		input: string,
	) => {
		const file = placementFile(directory, geography, "2024");
		writeFileSync(file, Buffer.from(Int32Array.from(area).buffer));
		writeFileSync(
			`${file}.json`,
			JSON.stringify({
				key: placementKey(key, input),
				atomsKey: key,
				codes,
			}),
		);
	};
	place(
		"ward",
		["A", "B", "C", "N08000001"],
		[0, 0, 0, 0, 0, 0, 1, 1, 1, 2],
		"ward-input",
	);
	place(
		"constituency",
		["X", "Y", "Z"],
		[0, 0, 0, 0, 1, 1, 1, 1, 1, 2].map((value, at) =>
			at === 5 ? -1 : value,
		),
		"constituency-input",
	);
	const sources: GeometrySourceLookup = new Map([
		["ward/2024", { inputHash: "ward-input" }],
		["constituency/2024", { inputHash: "constituency-input" }],
	]) as unknown as GeometrySourceLookup;
	const names = (codes: string[]) =>
		new Map(codes.map((code) => [code, { code, name: `Area ${code}` }]));
	const lookup: AreaLookup = new Map([
		["ward/2024", names(["A", "B", "C", "N08000001"])],
		["constituency/2024", names(["X", "Y", "Z"])],
	]);
	return { root, sources, lookup };
};

test("every target holding a source's people is an edge, weighed by residents and renormalised", (context) => {
	const { root, sources, lookup } = fixture(context);
	const artifact = compilePostcodeOverlapCrosswalk(
		root,
		adapter(0.001),
		sources,
		lookup,
	);
	const [a, b, c] = artifact.records;
	// A has 60 people: 40 in X, 10 in Y, and 10 in no constituency.
	assert.equal(a!.source.population, 60);
	assert.deepEqual(
		a!.targets.map((target) => [target.code, target.population]),
		[
			["X", 40],
			["Y", 10],
		],
	);
	assert.deepEqual(
		a!.targets.map((target) => target.weight),
		[0.8, 0.2],
	);
	assert.ok(Math.abs(a!.source.coverage - 50 / 60) < 1e-8);
	assert.ok(Math.abs(a!.targets[0]!.sourceShare - 40 / 60) < 1e-8);
	// X holds only A's people; Y holds A's 10 and B's 30.
	assert.equal(a!.targets[0]!.targetShare, 1);
	assert.equal(a!.targets[1]!.targetShare, 0.25);
	assert.deepEqual(
		[b!.targets.map((target) => target.code), b!.targets[0]!.weight],
		[["Y"], 1],
	);
	assert.deepEqual(
		c!.targets.map((target) => target.code),
		["Z"],
	);
	assert.equal(artifact.validation.overlap.pairCount, 4);
	assert.equal(artifact.validation.overlap.droppedPairCount, 0);
	assert.ok(
		Math.abs(
			artifact.validation.overlap.unplacedPopulationShare - 10 / 100,
		) < 1e-8,
	);
	assert.deepEqual(artifact.validation.endpoints.from.status, "verified");
	// The ward in Northern Ireland has no postcodes, so no targets, and says why.
	assert.deepEqual(artifact.records[3]!.targets, []);
	assert.deepEqual(artifact.validation.coverage, {
		sourceCount: 4,
		placedSources: 3,
		unplacedSources: 1,
		unplacedReasons: [
			{
				reason: "no postcodes in ONSPD for Northern Ireland",
				count: 1,
			},
		],
	});
});

test("a pair under the minimum share on every basis is dropped and the rest renormalised", (context) => {
	const { root, sources, lookup } = fixture(context);
	// A's pair with Y holds 1/6 of its people: dropped above that share.
	const artifact = compilePostcodeOverlapCrosswalk(
		root,
		adapter(0.2),
		sources,
		lookup,
	);
	const [a] = artifact.records;
	assert.deepEqual(
		a!.targets.map((target) => [target.code, target.weight]),
		[["X", 1]],
	);
	assert.ok(Math.abs(a!.source.coverage - 40 / 60) < 1e-8);
	assert.equal(artifact.validation.overlap.droppedPairCount, 1);
	assert.equal(artifact.validation.overlap.keptPairCount, 3);
});

test("a placement of other atoms is refused", (context) => {
	const { root, sources, lookup } = fixture(context);
	writeFileSync(
		join(weightAtomsDirectory(root), "atoms.json"),
		JSON.stringify({
			key: "other",
			count: 10,
			postcodes: 10,
			outputAreas: 0,
			totals: {},
		}),
	);
	assert.throws(
		() =>
			compilePostcodeOverlapCrosswalk(
				root,
				adapter(0.001),
				sources,
				lookup,
			),
		/rebuild weight-atoms/,
	);
});
