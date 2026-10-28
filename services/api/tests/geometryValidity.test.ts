import assert from "node:assert/strict";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parse } from "yaml";
import { buildGeometryStore } from "../../../pipeline/src/buildGeometryStore";
import {
	compileGeometryValidity,
	roundKeepingValidity,
} from "../../../pipeline/src/compileGeometryValidity";
import { compiledGeometryFile, type GeometrySource } from "../src/areaGeometry";
import { createAreaLookup } from "../src/areaInventory";
import { sha256 } from "../src/contentHash";
import { createAreaGeometryCache } from "../src/geometryLoader";
import { encodeGeometryStore, readGeometryStore } from "../src/geometryStore";
import {
	GEOMETRY_VALIDITY_METHOD,
	uncompiledGeometryValidity,
} from "@uk-data-atlas/geography";
import { packGeometry, unpackGeometry } from "../src/packedGeometry";
import { route } from "../src/routes";
import fixtures from "./fixtures/geometry-validity.json";
import { schemaViolations, type SchemaDocument } from "./openapiSchema";
import { registry, testContext } from "./routeFixtures";
import { artifactRoot } from "../../../shared/dataLayout";

const spec: SchemaDocument = parse(
	readFileSync(new URL("../openapi.yaml", import.meta.url), "utf8"),
);

for (const fixture of fixtures.features) {
	test(`validates ${fixture.properties.name} without repairing it`, () => {
		const packed = packGeometry(fixture.geometry);
		const before = JSON.stringify(packed);
		const report = compileGeometryValidity(packed);
		assert.equal(report.status, fixture.properties.status);
		assert.deepEqual(report.method, GEOMETRY_VALIDITY_METHOD);
		if (report.status === "invalid")
			assert.equal(report.issue.code, fixture.properties.code);
		assert.equal(JSON.stringify(packed), before);
		assert.deepEqual(compileGeometryValidity(packed), report);
		assert.deepEqual(
			schemaViolations(
				spec,
				{ $ref: "#/components/schemas/GeometryValidity" },
				report,
			),
			[],
		);
	});
}

test("bounds validation and identifies geometries it has not checked", () => {
	const ring = Array.from({ length: 10_001 }, (_, index) => [index, 50]);
	assert.deepEqual(
		compileGeometryValidity(
			packGeometry({ type: "Polygon", coordinates: [ring] }),
		),
		{
			method: GEOMETRY_VALIDITY_METHOD,
			status: "not-checked",
			reason: "position-limit",
		},
	);
	assert.deepEqual(
		compileGeometryValidity(
			packGeometry({
				type: "MultiPolygon",
				coordinates: Array.from({ length: 10_001 }, () => []),
			}),
		),
		{
			method: GEOMETRY_VALIDITY_METHOD,
			status: "not-checked",
			reason: "position-limit",
		},
	);
	for (const geometry of [
		{ type: "Point", coordinates: [0, 50] },
		{
			type: "GeometryCollection",
			geometries: [fixtures.features[0]!.geometry],
		},
	])
		assert.deepEqual(compileGeometryValidity(packGeometry(geometry)), {
			method: GEOMETRY_VALIDITY_METHOD,
			status: "not-checked",
			reason: "unsupported-geometry",
		});
	assert.deepEqual(
		compileGeometryValidity(
			packGeometry({
				type: "Polygon",
				coordinates: [
					[
						[0, 50],
						[1, 50],
						[1, NaN],
						[0, 50],
					],
				],
			}),
		),
		{
			method: GEOMETRY_VALIDITY_METHOD,
			status: "invalid",
			issue: {
				code: "invalid-coordinate",
				message: "Positions must have finite X and Y ordinates.",
			},
		},
	);
});

test("rounds areas to seven decimal places unless that breaks a valid one", () => {
	const square = [
		[
			[0, 0],
			[1, 0],
			[1, 1],
			[0, 1],
			[0, 0],
		],
	];
	// Four billionths of a degree east of the square: rounding puts its
	// west edge on the square's east edge.
	const near = [
		[
			[1.00000004, 0.4],
			[2, 0.4],
			[2, 0.6],
			[1.00000004, 0.6],
			[1.00000004, 0.4],
		],
	];
	const islands = packGeometry({
		type: "MultiPolygon",
		coordinates: [square, near],
	});
	assert.equal(compileGeometryValidity(islands).status, "valid");
	assert.equal(roundKeepingValidity(islands), islands);

	const far = packGeometry({
		type: "MultiPolygon",
		coordinates: [
			square,
			near.map((ring) => ring.map(([x, y]) => [x! + 0.5, y!])),
		],
	});
	assert.deepEqual(
		(
			unpackGeometry(roundKeepingValidity(far))
				.coordinates as number[][][][]
		)[1]?.[0]?.[0],
		[1.5, 0.4],
	);

	// Already invalid: rounded like any other area.
	const bowTie = packGeometry({
		type: "Polygon",
		coordinates: [
			[
				[0, 0],
				[1, 1],
				[1, 0],
				[0.00000004, 1],
				[0, 0],
			],
		],
	});
	assert.deepEqual(
		(
			unpackGeometry(roundKeepingValidity(bowTie))
				.coordinates as number[][][]
		)[0]?.[3],
		[0, 1],
	);
});

test("validates XY while preserving additional ordinates", () => {
	const geometry = {
		type: "Polygon",
		coordinates: [
			[
				[0, 50, 1],
				[1, 50, 2],
				[1, 51, 3],
				[0, 51, 4],
				[0, 50, 5],
			],
		],
	};
	const packed = packGeometry(geometry);
	const before = JSON.stringify(packed);
	assert.deepEqual(compileGeometryValidity(packed), {
		method: GEOMETRY_VALIDITY_METHOD,
		status: "valid",
	});
	assert.equal(JSON.stringify(packed), before);
});

test("compiles deterministic reports and serves them with metrics and provenance", (t) => {
	const root = mkdtempSync(join(tmpdir(), "atlas-validity-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const apiRoot = join(root, "services", "api");
	const publicRoot = artifactRoot(apiRoot);
	mkdirSync(publicRoot, { recursive: true });
	mkdirSync(apiRoot, { recursive: true });
	mkdirSync(join(root, "data/source", "boundaries"), { recursive: true });
	for (const directory of ["src", "scripts"])
		symlinkSync(
			new URL(`../${directory}`, import.meta.url),
			join(apiRoot, directory),
			"dir",
		);
	symlinkSync(
		new URL("../../../shared", import.meta.url),
		join(root, "shared"),
		"dir",
	);
	symlinkSync(
		new URL("../../../pipeline", import.meta.url),
		join(root, "pipeline"),
		"dir",
	);
	symlinkSync(
		new URL("../../../packages", import.meta.url),
		join(root, "packages"),
		"dir",
	);
	copyFileSync(
		new URL("../package.json", import.meta.url),
		join(apiRoot, "package.json"),
	);
	const features = fixtures.features.map((feature, index) => ({
		...feature,
		properties: {
			...feature.properties,
			CODE: `E05${String(index + 1).padStart(6, "0")}`,
		},
	}));
	const sourceBytes = JSON.stringify({ ...fixtures, features });
	const source: GeometrySource = {
		input: "boundaries/fixture.geojson",
		inputHash: sha256(sourceBytes),
		crs: "EPSG:4326",
		codeProperty: "CODE",
	};
	const sourcePath = join(root, "data/source", source.input);
	writeFileSync(sourcePath, sourceBytes);
	writeFileSync(
		join(publicRoot, "geometry-sources.json"),
		JSON.stringify({
			schemaVersion: 1,
			releases: [
				{ id: "ward/2025-01-en-ward", status: "available", ...source },
			],
		}),
	);
	const first = buildGeometryStore(root);
	assert.equal(first.compiled, 1);
	const storePath = join(
		first.directory,
		compiledGeometryFile("ward", "2025-01-en-ward"),
	);
	const firstBytes = readFileSync(storePath);
	assert.equal(buildGeometryStore(root).compiled, 0);
	rmSync(storePath);
	assert.equal(buildGeometryStore(root).compiled, 1);
	assert.deepEqual(readFileSync(storePath), firstBytes);
	assert.equal(readFileSync(sourcePath, "utf8"), sourceBytes);
	assert.equal(sha256(readFileSync(sourcePath)), source.inputHash);
	const stored = readGeometryStore(storePath, source)!;
	t.after(() => stored.close());
	assert.equal(stored.validity("missing"), undefined);
	const bowTie = stored.validity(features[2]!.properties.CODE);
	assert.equal(bowTie?.status, "invalid");
	assert.deepEqual(bowTie?.method, GEOMETRY_VALIDITY_METHOD);
	if (bowTie?.status === "invalid")
		assert.deepEqual(bowTie.issue, {
			code: "self-intersection",
			message: "Self-intersection",
			coordinate: [2, 52],
		});
	rmSync(sourcePath);
	const cache = createAreaGeometryCache(apiRoot);
	const areaLookup = createAreaLookup([
		{
			schemaVersion: 1,
			contentHash: "sha256:fixtures",
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			codeProperty: "CODE",
			nameProperty: "name",
			areas: features.map(({ properties }) => ({
				code: properties.CODE,
				name: properties.name,
			})),
		},
	]);
	const context = testContext({
		boundaryRegistry: registry,
		areaLookup,
		areaGeometryCache: cache,
	});
	for (const { properties, geometry } of features) {
		const base = `/v1/areas/ward/2025-01-en-ward/${properties.CODE}`;
		const expected = stored.validity(properties.CODE);
		const response = route("GET", `${base}?include=metrics`, context);
		const body = response.body;
		const unmeasurable = [
			"bow-tie",
			"short-ring",
			"repeated-point-ring",
			"collinear-ring",
		].includes(properties.name);
		assert.equal(
			response.status,
			properties.name === "null-coordinate"
				? 503
				: unmeasurable
					? 422
					: 200,
			properties.name,
		);
		if (response.status === 200) {
			assert.deepEqual(
				schemaViolations(
					spec,
					{ $ref: "#/components/schemas/AreaEnvelope" },
					body,
				),
				[],
			);
			assert.ok("data" in body);
			const data = body.data as {
				metrics: { geometrySource: unknown; geometryHash: string };
			};
			assert.deepEqual(data.metrics.geometrySource, {
				sourceCrs: "EPSG:4326",
				input: source.input,
				inputHash: source.inputHash,
				validity: expected,
			});
			assert.equal(
				data.metrics.geometryHash,
				sha256(JSON.stringify(geometry)),
			);
		} else {
			assert.ok("geometrySource" in body);
			assert.deepEqual(body.geometrySource?.validity, expected);
			assert.deepEqual(
				schemaViolations(
					spec,
					{ $ref: "#/components/schemas/Problem" },
					body,
				),
				[],
			);
		}
		const served = route("GET", `${base}/geometry?tier=full`, context);
		assert.equal(served.status, 200);
		assert.deepEqual(
			schemaViolations(
				spec,
				{ $ref: "#/components/schemas/AreaGeometryEnvelope" },
				served.body,
			),
			[],
		);
		assert.ok("data" in served.body);
		const feature = served.body.data as {
			geometry: unknown;
			properties: { geometrySource: { validity: unknown } };
		};
		assert.deepEqual(feature.geometry, geometry);
		assert.deepEqual(feature.properties.geometrySource.validity, expected);
	}
});

test("reads older stores without claiming their geometry was validated", (t) => {
	const root = mkdtempSync(join(tmpdir(), "atlas-validity-legacy-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const source: GeometrySource = {
		input: "fixture.geojson",
		crs: "EPSG:4326",
		codeProperty: "CODE",
	};
	const path = join(root, "legacy.bin");
	writeFileSync(
		path,
		encodeGeometryStore(source, [
			["A", packGeometry(fixtures.features[0]!.geometry)],
		]),
	);
	const stored = readGeometryStore(path, source)!;
	t.after(() => stored.close());
	assert.deepEqual(stored.validity("A"), uncompiledGeometryValidity);
});
