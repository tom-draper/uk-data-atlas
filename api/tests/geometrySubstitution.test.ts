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
import test from "node:test";
import {
	AreaGeometryCache,
	type GeometrySourceLookup,
} from "../src/areaGeometry";
import { offsetPosition, readGridOffset } from "../src/gridOffset";
import { toWgs84Geometry } from "../src/reprojection";

const SUBSTITUTION = "northern-ireland-constituencies-2016";

const square = (x: number, y: number, size: number) => ({
	type: "Polygon",
	coordinates: [
		[
			[x, y],
			[x + size, y],
			[x + size, y + size],
			[x, y],
		],
	],
});

/** A shifted 2019 release and the accurate 2016 release it borrows from. */
const fixture = (donorCodes: string[]) => {
	const root = mkdtempSync(join(tmpdir(), "geometry-substitution-"));
	const write = (release: string, file: string, collection: unknown) => {
		const directory = join(
			root,
			"data",
			"boundaries",
			"constituency",
			release,
		);
		mkdirSync(directory, { recursive: true });
		writeFileSync(join(directory, file), JSON.stringify(collection));
	};
	write("2019-12-uk-bgc", "2019.geojson", {
		type: "FeatureCollection",
		features: [
			{
				properties: { pcon19cd: "E14000530" },
				geometry: square(-1.5, 52.5, 0.01),
			},
			{
				properties: { pcon19cd: "N06000001" },
				geometry: square(-5.8, 54.6, 0.01),
			},
		],
	});
	write("2016-12-uk-bgc", "2016.geojson", {
		type: "FeatureCollection",
		crs: { type: "name", properties: { name: "EPSG:27700" } },
		features: donorCodes.map((code) => ({
			properties: { pcon16cd: code },
			geometry: square(146000, 530000, 500),
		})),
	});
	const sources: GeometrySourceLookup = new Map([
		[
			"constituency/2019-12-uk-bgc",
			{
				input: "boundaries/constituency/2019-12-uk-bgc/2019.geojson",
				crs: "EPSG:4326",
				codeProperty: "pcon19cd",
				substitutions: [SUBSTITUTION],
			},
		],
		[
			"constituency/2016-12-uk-bgc",
			{
				input: "boundaries/constituency/2016-12-uk-bgc/2016.geojson",
				inputHash: "sha256:donor",
				crs: "EPSG:27700",
				codeProperty: "pcon16cd",
			},
		],
	]);
	return { root, cache: new AreaGeometryCache(root, sources) };
};

test("takes a substituted area from the donor release, reprojected", () => {
	const { root, cache } = fixture(["N06000001"]);
	try {
		assert.deepEqual(
			cache.get("constituency", "2019-12-uk-bgc", "N06000001"),
			toWgs84Geometry(square(146000, 530000, 500), "EPSG:27700"),
		);
		// Areas outside the substitution stay as the release published them.
		assert.deepEqual(
			cache.get("constituency", "2019-12-uk-bgc", "E14000530"),
			square(-1.5, 52.5, 0.01),
		);
		const [correction] =
			cache.provenance("constituency", "2019-12-uk-bgc", "N06000001")
				.corrections ?? [];
		assert.equal(correction?.id, SUBSTITUTION);
		assert.match(
			correction?.description ?? "",
			/2016-12-uk-bgc\/2016\.geojson \(sha256:donor\)/,
		);
		assert.equal(
			cache.provenance("constituency", "2019-12-uk-bgc", "E14000530")
				.corrections,
			undefined,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("refuses a substitution whose releases hold different codes", () => {
	const { root, cache } = fixture(["N06000001", "N06000002"]);
	try {
		assert.throws(
			() => cache.get("constituency", "2019-12-uk-bgc", "N06000001"),
			/unmatched: N06000002/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("undoes a grid offset a WGS84 release carries backwards", () => {
	const root = mkdtempSync(join(tmpdir(), "reversed-offset-"));
	try {
		const boundaries = join(root, "data", "boundaries");
		const directory = join(boundaries, "travel-to-work-area", "2011");
		mkdirSync(directory, { recursive: true });
		writeFileSync(
			join(boundaries, "northern-ireland-offset.json"),
			readFileSync(
				new URL(
					"../../data/boundaries/northern-ireland-offset.json",
					import.meta.url,
				),
				"utf8",
			),
		);
		const offset = readGridOffset(root, "northern-ireland-offset");
		// A point near Belfast, published where the offset would put it.
		const truth: [number, number] = [146000, 530000];
		const published = toWgs84Geometry(
			{ type: "Point", coordinates: offsetPosition(offset, truth) },
			"EPSG:27700",
		);
		writeFileSync(
			join(directory, "ttwa.geojson"),
			JSON.stringify({
				type: "FeatureCollection",
				features: [
					{
						properties: { TTWA11CD: "N12000002" },
						geometry: published,
					},
					{
						properties: { TTWA11CD: "E30000234" },
						geometry: { type: "Point", coordinates: [-0.1, 51.5] },
					},
				],
			}),
		);
		const cache = new AreaGeometryCache(
			root,
			new Map([
				[
					"travelToWorkArea/2011-12-uk-gcb",
					{
						input: "boundaries/travel-to-work-area/2011/ttwa.geojson",
						crs: "EPSG:4326",
						codeProperty: "TTWA11CD",
						reversedOffsets: ["northern-ireland-offset-reversed"],
					},
				],
			]),
		);
		const expected = toWgs84Geometry(
			{ type: "Point", coordinates: truth },
			"EPSG:27700",
		) as { coordinates: [number, number] };
		const belfast = cache.get(
			"travelToWorkArea",
			"2011-12-uk-gcb",
			"N12000002",
		) as { coordinates: [number, number] };
		// Within the 1e-7 degree rounding of the two reprojections.
		assert.ok(
			Math.abs(belfast.coordinates[0] - expected.coordinates[0]) < 3e-7 &&
				Math.abs(belfast.coordinates[1] - expected.coordinates[1]) <
					3e-7,
			`${belfast.coordinates} against ${expected.coordinates}`,
		);
		assert.deepEqual(
			cache.get("travelToWorkArea", "2011-12-uk-gcb", "E30000234"),
			{ type: "Point", coordinates: [-0.1, 51.5] },
		);
		assert.deepEqual(
			cache
				.provenance("travelToWorkArea", "2011-12-uk-gcb", "N12000002")
				.corrections?.map(({ id }) => id),
			["northern-ireland-offset-reversed"],
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
