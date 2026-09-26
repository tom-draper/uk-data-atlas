import assert from "node:assert/strict";
import test from "node:test";
import {
	compilePostcodeIndex,
	NORTHERN_IRELAND_EXCLUSION,
	parsePostcode,
	PostcodeIndex,
	postcodeIndexMismatch,
	postcodeLookupPoint,
	type ParsedPostcode,
} from "../src/postcodes";
import {
	postcodeIndexFor,
	postcodeRow,
	postcodeSource,
} from "./postcodeFixtures";

const unit = (text: string) =>
	parsePostcode(text) as Extract<ParsedPostcode, { kind: "unit" }>;

test("reads a postcode however it was typed", () => {
	assert.deepEqual(parsePostcode(" sw1a1aa "), {
		kind: "unit",
		compact: "SW1A1AA",
		display: "SW1A 1AA",
		area: "SW",
		district: "SW1A",
	});
	assert.deepEqual(parsePostcode("m1  1ae"), {
		kind: "unit",
		compact: "M11AE",
		display: "M1 1AE",
		area: "M",
		district: "M1",
	});
	// Two non-geographic postcodes the directory holds.
	assert.equal(unit("GIR 0AA").area, "GIR");
	assert.equal(unit("NPT 1AA").area, "NPT");
	assert.deepEqual(parsePostcode("SW1A"), {
		kind: "district",
		display: "SW1A",
	});
	assert.deepEqual(parsePostcode("sw1a1"), {
		kind: "sector",
		display: "SW1A 1",
	});
	for (const text of ["", "Bristol", "SW1A 1A", "1AA 1AA", "SW1A 1AAA"])
		assert.equal(parsePostcode(text), undefined, text);
});

test("shards postcodes by district, sorted by code unit", () => {
	const { artifact, files } = compilePostcodeIndex(
		[
			postcodeRow("M1 1AE"),
			postcodeRow("B1 1AA"),
			postcodeRow("M11 1AA"),
			postcodeRow("M1 1AA", { doterm: "201005" }),
			postcodeRow("GIR 0AA", { gridind: "9", east1m: "", north1m: "" }),
		],
		postcodeSource,
	);
	assert.deepEqual(
		artifact.shards.map((shard) => [
			shard.district,
			shard.path,
			shard.postcodes,
		]),
		[
			["B1", "postcodes/B/B1.json", 1],
			["GIR", "postcodes/GIR/GIR.json", 1],
			["M1", "postcodes/M/M1.json", 2],
			["M11", "postcodes/M/M11.json", 1],
		],
	);
	assert.deepEqual(artifact.counts, {
		postcodes: 5,
		live: 4,
		terminated: 1,
		withoutGridReference: 1,
	});
	const m = JSON.parse(
		files.find((file) => file.path === "postcodes/M/M1.json")!.text,
	);
	assert.deepEqual(m.postcodes, ["M11AA", "M11AE"]);
	assert.deepEqual(m.terminated, [201005, 0]);
	assert.equal(postcodeIndexMismatch(artifact), undefined);
	assert.match(
		postcodeIndexMismatch({
			...artifact,
			counts: { ...artifact.counts, live: 5 },
		})!,
		/own content hash/,
	);
});

test("refuses a directory it would misread", () => {
	const compile =
		(...rows: ReturnType<typeof postcodeRow>[]) =>
		() =>
			compilePostcodeIndex(rows, postcodeSource);
	assert.throws(
		compile(postcodeRow("M1 1AE"), postcodeRow("M1 1AE")),
		/twice/,
	);
	assert.throws(compile(postcodeRow("M11AE")), /not a unit postcode/);
	assert.throws(compile(postcodeRow("M1 1AE", { gridind: "7" })), /gridind/);
	assert.throws(
		compile(postcodeRow("M1 1AE", { gridind: "9" })),
		/disagrees with its grid reference/,
	);
	assert.throws(compile(postcodeRow("M1 1AE", { dointr: "1980" })), /YYYYMM/);
	assert.throws(
		compile(postcodeRow("M1 1AE", { ctry: "X99999999" })),
		/country/,
	);
});

test("leaves Northern Ireland out unless asked, and says why", () => {
	const rows = [
		postcodeRow("BT1 1AA", {
			ctry: "N92000002",
			east1m: "333000",
			north1m: "374000",
		}),
		postcodeRow("M1 1AE"),
	];
	const { index, artifact } = postcodeIndexFor(rows);
	assert.deepEqual(artifact.excluded, [
		{ area: "BT", postcodes: 1, reason: NORTHERN_IRELAND_EXCLUSION },
	]);
	assert.deepEqual(index.lookup(unit("BT1 1AA")), {
		status: "excluded",
		reason: NORTHERN_IRELAND_EXCLUSION,
	});
	const included = postcodeIndexFor(rows, { includeNorthernIreland: true });
	const found = included.index.lookup(unit("bt11aa"));
	assert.equal(found.status, "found");
	assert.equal(
		found.status === "found" && found.record.centroid?.crs,
		"EPSG:29902",
	);
});

test("describes each postcode from its shard, reading a shard once", () => {
	const { index, reads } = postcodeIndexFor([
		postcodeRow("M1 1AE", { usrtypind: "1", dointr: "200112" }),
		postcodeRow("M1 1AA", {
			doterm: "201005",
			gridind: "8",
			east1m: "384000",
			north1m: "398000",
		}),
		postcodeRow("S1 1AA", { ctry: "S92000003", gridind: "8" }),
		postcodeRow("M1 1AB", { gridind: "5" }),
	]);
	assert.deepEqual(index.lookup(unit("M1 1AE")), {
		status: "found",
		record: {
			postcode: "M1 1AE",
			status: "live",
			introduced: "2001-12",
			userType: "large",
			country: "E92000001",
			centroid: {
				crs: "EPSG:27700",
				easting: 530000,
				northing: 180000,
				positionalQuality: {
					indicator: 1,
					description:
						"Within the building of the matched address closest to the postcode mean.",
					accuracyM: 0.5,
				},
			},
		},
	});
	const terminated = index.lookup(unit("M1 1AA"));
	assert.equal(
		terminated.status === "found" && terminated.record.terminated,
		"2010-05",
	);
	// Pre-2000 grid references: 100 m cells in England and Wales, 10 m elsewhere.
	assert.equal(
		terminated.status === "found" &&
			terminated.record.centroid?.positionalQuality.accuracyM,
		70.71,
	);
	const scottish = index.lookup(unit("S1 1AA"));
	assert.equal(
		scottish.status === "found" &&
			scottish.record.centroid?.positionalQuality.accuracyM,
		7.07,
	);
	const imputed = index.lookup(unit("M1 1AB"));
	assert.equal(
		imputed.status === "found" &&
			imputed.record.centroid?.positionalQuality.accuracyM,
		null,
	);
	assert.deepEqual(index.lookup(unit("M1 9ZZ")), { status: "not-found" });
	assert.deepEqual(index.lookup(unit("ZE1 1AA")), { status: "not-found" });
	assert.deepEqual(reads, ["postcodes/M/M1.json", "postcodes/S/S1.json"]);
});

test("keeps only the most recently used shards in memory", () => {
	const { index, reads } = postcodeIndexFor(
		[postcodeRow("B1 1AA"), postcodeRow("M1 1AA"), postcodeRow("S1 1AA")],
		{ capacity: 2 },
	);
	for (const postcode of [
		"B1 1AA",
		"M1 1AA",
		"B1 1AA",
		"S1 1AA",
		"B1 1AA",
		"M1 1AA",
	])
		index.lookup(unit(postcode));
	assert.deepEqual(reads, [
		"postcodes/B/B1.json",
		"postcodes/M/M1.json",
		"postcodes/S/S1.json",
		"postcodes/M/M1.json",
	]);
});

test("refuses a shard that no longer matches its manifest", () => {
	const { artifact, texts } = postcodeIndexFor([postcodeRow("M1 1AA")]);
	const index = new PostcodeIndex(artifact, (path) =>
		texts.get(path)!.replace("530000", "530001"),
	);
	assert.throws(
		() => index.lookup(unit("M1 1AA")),
		/Run pnpm build:postcode-index/,
	);
});

test("places a centroid as a grid point, with the accuracy the directory states", () => {
	const { index } = postcodeIndexFor([
		postcodeRow("M1 1AA"),
		postcodeRow("M1 1AB", { gridind: "3" }),
	]);
	const pointOf = (postcode: string) => {
		const found = index.lookup(unit(postcode));
		assert.equal(found.status, "found");
		return postcodeLookupPoint(
			(found as Extract<typeof found, { status: "found" }>).record
				.centroid!,
		);
	};
	const precise = pointOf("M1 1AA");
	assert.equal(precise.input?.crs, "EPSG:27700");
	assert.equal(precise.precision.basis, "decimal-places-and-transformation");
	assert.equal(precise.precision.uncertaintyM, 2.5);
	const approximate = pointOf("M1 1AB");
	assert.equal(
		approximate.precision.basis,
		"stated-accuracy-and-transformation",
	);
	assert.equal(approximate.precision.uncertaintyM, 52);
});
