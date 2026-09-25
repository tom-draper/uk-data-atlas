import assert from "node:assert/strict";
import test from "node:test";
import {
	boundaryDistanceFinder,
	distanceToBoundaryM,
} from "../src/areaDistance";
import { containPoint } from "../src/areaContainment";
import type { GeoJsonGeometry } from "../src/areaGeometry";
import {
	compilePostcodeAreas,
	NONE,
	PostcodeAreaIndex,
	placementsFromShards,
	placePoints,
	postcodeAreasMismatch,
	SEVERAL,
	type PostcodeAreasShard,
} from "../src/postcodeAreas";
import { postcodeIndexFor, postcodeRow } from "./postcodeFixtures";

const square = (
	west: number,
	south: number,
	east: number,
	north: number,
): GeoJsonGeometry => ({
	type: "Polygon",
	coordinates: [
		[
			[west, south],
			[east, south],
			[east, north],
			[west, north],
			[west, south],
		],
	],
});

// A lake inside a west area, and an east area sharing its edge at x = 0.
const areas: Record<string, GeoJsonGeometry> = {
	W1: {
		type: "Polygon",
		coordinates: [
			[
				[-1, 50],
				[0, 50],
				[0, 51],
				[-1, 51],
				[-1, 50],
			],
			[
				[-0.6, 50.4],
				[-0.4, 50.4],
				[-0.4, 50.6],
				[-0.6, 50.6],
				[-0.6, 50.4],
			],
		],
	},
	E1: square(0, 50, 1, 51),
	N1: {
		type: "MultiPolygon",
		coordinates: [
			square(-1, 51, 0, 52).coordinates as unknown,
			square(0.5, 51.5, 0.7, 51.7).coordinates as unknown,
		],
	},
};

test("measures the nearest edge exactly as distanceToBoundaryM does", () => {
	for (const geometry of Object.values(areas)) {
		const nearest = boundaryDistanceFinder(geometry);
		for (let x = -1.2; x <= 1.2; x += 0.07)
			for (let y = 49.8; y <= 52.2; y += 0.09)
				assert.equal(
					nearest([x, y]),
					distanceToBoundaryM([x, y], geometry),
				);
	}
});

test("places each point in the areas a live containment test finds", () => {
	const points: Array<[number, number]> = [
		[-0.8, 50.2], // west
		[0.3, 50.7], // east
		[0, 50.5], // on the shared edge
		[-0.5, 50.5], // in the lake
		[0.6, 51.6], // the northern area's island
		[3, 3], // nowhere
	];
	const longitudes = Float64Array.from([
		...points.map(([x]) => x),
		Number.NaN,
	]);
	const latitudes = Float64Array.from([
		...points.map(([, y]) => y),
		Number.NaN,
	]);
	const placed = placePoints(
		longitudes,
		latitudes,
		Object.keys(areas),
		(code) => areas[code],
	);
	assert.deepEqual(placed.codes, ["E1", "N1", "W1"]);
	const described = [...placed.area].map((area, at) =>
		area === NONE
			? []
			: area === SEVERAL
				? placed.several
						.get(at)!
						.map(([code, containment]) => [
							placed.codes[code],
							containment,
						])
				: [[placed.codes[area], "interior"]],
	);
	assert.deepEqual(described, [
		[["W1", "interior"]],
		[["E1", "interior"]],
		[
			["E1", "boundary"],
			["W1", "boundary"],
		],
		[],
		[["N1", "interior"]],
		[],
		[],
	]);
	points.forEach((point, at) => {
		for (const [code, geometry] of Object.entries(areas)) {
			const live = containPoint(point, geometry);
			assert.equal(
				live !== "outside",
				described[at]!.some(([found]) => found === code),
			);
		}
	});
	assert.equal(
		placed.distanceCm[0],
		Math.round(distanceToBoundaryM(points[0]!, areas.W1!) * 100),
	);
});

const rows = [
	postcodeRow("EC1A 1AA", { east1m: "529700" }),
	postcodeRow("EC1A 1AB", { east1m: "530300" }),
	postcodeRow("GY1 1AA", {
		gridind: "9",
		east1m: "",
		north1m: "",
		ctry: "L93000001",
	}),
];

const compiled = () => {
	const { index, artifact } = postcodeIndexFor(rows);
	// Shard order: EC1A 1AA, EC1A 1AB, then GY1 1AA with no centroid.
	const placements = {
		codes: ["E05000001", "E05000002"],
		area: Int32Array.from([0, SEVERAL, NONE]),
		distanceCm: Int32Array.from([1234, 0, 0]),
		several: new Map([
			[
				1,
				[
					[0, "boundary", 0],
					[1, "boundary", 0],
				] as Array<[number, "interior" | "boundary", number]>,
			],
		]),
	};
	const release = {
		geography: "ward",
		boundaryRelease: "2026-05-uk-bgc",
		purposes: ["default-lookup" as const],
		areaRelease: "sha256:areas",
		geometryInput: "sha256:geometry",
		counts: { placed: 2, unplaced: 0, several: 1 },
	};
	return {
		index,
		postcodeArtifact: artifact,
		placements,
		...compilePostcodeAreas(artifact, [{ release, placements }]),
	};
};

test("answers a postcode's areas from its district's shard", () => {
	const { index, artifact, files } = compiled();
	assert.deepEqual(
		files.map((file) => file.path),
		["postcode-areas/EC/EC1A.json", "postcode-areas/GY/GY1.json"],
	);
	const texts = new Map(files.map((file) => [file.path, file.text]));
	const reads: string[] = [];
	const areaIndex = new PostcodeAreaIndex(artifact, index, (path) => {
		reads.push(path);
		return texts.get(path)!;
	});
	assert.equal(areaIndex.covers("ward", "2026-05-uk-bgc"), true);
	assert.equal(areaIndex.covers("ward", "2025-12-uk-bgc"), false);
	assert.deepEqual(
		areaIndex.containing("EC1A1AA", "ward", "2026-05-uk-bgc"),
		[
			{
				code: "E05000001",
				containment: "interior",
				distanceToBoundaryM: 12.34,
			},
		],
	);
	assert.deepEqual(
		areaIndex
			.containing("EC1A1AB", "ward", "2026-05-uk-bgc")!
			.map((match) => [match.code, match.containment]),
		[
			["E05000001", "boundary"],
			["E05000002", "boundary"],
		],
	);
	assert.deepEqual(
		areaIndex.containing("GY11AA", "ward", "2026-05-uk-bgc"),
		[],
	);
	// Unknown to the index: the caller must place it live.
	assert.equal(
		areaIndex.containing("EC1A1AA", "ward", "2025-12-uk-bgc"),
		undefined,
	);
	assert.equal(
		areaIndex.containing("EC1A1ZZ", "ward", "2026-05-uk-bgc"),
		undefined,
	);
	assert.deepEqual(reads, [
		"postcode-areas/EC/EC1A.json",
		"postcode-areas/GY/GY1.json",
	]);
});

test("reads an earlier build's placements back unchanged", () => {
	const { files, placements, postcodeArtifact } = compiled();
	let offset = 0;
	const shards = postcodeArtifact.shards.map((entry, at) => {
		const located = {
			offset,
			shard: JSON.parse(files[at]!.text) as PostcodeAreasShard,
		};
		offset += entry.postcodes;
		return located;
	});
	assert.deepEqual(
		placementsFromShards("ward/2026-05-uk-bgc", shards, offset),
		placements,
	);
});

test("refuses a shard or manifest that no longer matches its inputs", () => {
	const { index, artifact, files, postcodeArtifact } = compiled();
	const inputs = {
		areaRelease: () => "sha256:areas",
		geometryInput: () => "sha256:geometry",
	};
	assert.equal(
		postcodeAreasMismatch(artifact, postcodeArtifact, inputs),
		undefined,
	);
	assert.match(
		postcodeAreasMismatch(
			artifact,
			postcodeIndexFor(rows.slice(1)).artifact,
			inputs,
		)!,
		/current postcode index/,
	);
	assert.match(
		postcodeAreasMismatch(artifact, postcodeArtifact, {
			...inputs,
			areaRelease: () => "sha256:changed",
		})!,
		/current areas of ward\/2026-05-uk-bgc/,
	);
	assert.match(
		postcodeAreasMismatch(artifact, postcodeArtifact, {
			...inputs,
			geometryInput: () => undefined,
		})!,
		/current geometry/,
	);
	assert.match(
		postcodeAreasMismatch(
			{ ...artifact, releases: [] },
			postcodeArtifact,
			inputs,
		)!,
		/own content hash/,
	);
	const tampered = new PostcodeAreaIndex(artifact, index, (path) =>
		files.find((file) => file.path === path)!.text.replace("1234", "4321"),
	);
	assert.throws(
		() => tampered.containing("EC1A1AA", "ward", "2026-05-uk-bgc"),
		/does not match the postcode area index/,
	);
});
