import { strict as assert } from "node:assert";
import { DuckDBInstance } from "@duckdb/node-api";
import { containPoint } from "../../shared/areaContainment";
import type { GeoJsonGeometry } from "../../shared/geometryTypes";

const areas: Array<{ code: string; geometry: GeoJsonGeometry }> = [
	{
		code: "west",
		geometry: {
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
	},
	{
		code: "east",
		geometry: {
			type: "Polygon",
			coordinates: [
				[
					[0, 50],
					[1, 50],
					[1, 51],
					[0, 51],
					[0, 50],
				],
			],
		},
	},
	{
		code: "islands",
		geometry: {
			type: "MultiPolygon",
			coordinates: [
				[
					[
						[-1, 51],
						[0, 51],
						[0, 52],
						[-1, 52],
						[-1, 51],
					],
				],
				[
					[
						[0.5, 51.5],
						[0.7, 51.5],
						[0.7, 51.7],
						[0.5, 51.7],
						[0.5, 51.5],
					],
				],
			],
		},
	},
];
const points: Array<[number, number]> = [
	[-0.8, 50.2],
	[0.3, 50.7],
	[0, 50.5],
	[-0.5, 50.5],
	[0.6, 51.6],
	[3, 3],
	[-5e-13, 50.5],
	[5e-13, 50.5],
];
const instance = await DuckDBInstance.create(":memory:");
const connection = await instance.connect();
try {
	await connection.run("INSTALL spatial; LOAD spatial");
	await connection.run(
		"CREATE TEMP TABLE areas (code VARCHAR, geometry GEOMETRY); CREATE TEMP TABLE points (position INTEGER, geometry GEOMETRY)",
	);
	for (const area of areas)
		await connection.run(
			"INSERT INTO areas VALUES (?, ST_GeomFromGeoJSON(?))",
			[area.code, JSON.stringify(area.geometry)],
		);
	for (const [position, [x, y]] of points.entries())
		await connection.run("INSERT INTO points VALUES (?, ST_Point(?, ?))", [
			position,
			x,
			y,
		]);
	const result = await connection.runAndReadAll(
		"SELECT p.position, a.code, CASE WHEN ST_Contains(a.geometry, p.geometry) THEN 'interior' ELSE 'boundary' END AS containment FROM points p JOIN areas a ON ST_Covers(a.geometry, p.geometry) ORDER BY p.position, a.code",
	);
	const actual = result
		.getRows()
		.map(([position, code, containment]) => [
			Number(position),
			String(code),
			String(containment),
		]);
	const expected = points
		.flatMap((point, position) =>
			areas.flatMap(({ code, geometry }) => {
				const containment = containPoint(point, geometry);
				return containment === "outside"
					? []
					: [[position, code, containment]];
			}),
		)
		.sort(
			(a, b) =>
				Number(a[0]) - Number(b[0]) ||
				String(a[1]).localeCompare(String(b[1])),
		);
	const candidates = await connection.runAndReadAll(
		"SELECT p.position, a.code FROM points p JOIN areas a ON ST_X(p.geometry) BETWEEN ST_XMin(a.geometry) - 1e-12 AND ST_XMax(a.geometry) + 1e-12 AND ST_Y(p.geometry) BETWEEN ST_YMin(a.geometry) - 1e-12 AND ST_YMax(a.geometry) + 1e-12 ORDER BY p.position, a.code",
	);
	const refined = candidates.getRows().flatMap(([position, code]) => {
		const at = Number(position);
		const area = areas.find((entry) => entry.code === String(code))!;
		const containment = containPoint(points[at]!, area.geometry);
		return containment === "outside" ? [] : [[at, area.code, containment]];
	});
	assert.deepEqual(refined, expected);
	const stringify = (row: unknown[]) => JSON.stringify(row);
	const expectedKeys = new Set(expected.map(stringify));
	const actualKeys = new Set(actual.map(stringify));
	assert.deepEqual(
		actual.filter(([position]) => Number(position) < 6),
		expected.filter(([position]) => Number(position) < 6),
	);
	assert.equal(
		expected.filter(([position]) => Number(position) >= 6).length,
		4,
	);
	assert.equal(
		actual.filter(([position]) => Number(position) >= 6).length,
		2,
	);
	console.log(
		JSON.stringify(
			{
				candidatePairs: candidates.getRows().length,
				refinedMatches: refined.length,
				points: points.length,
				areas: areas.length,
				expected,
				actual,
				missing: expected.filter(
					(row) => !actualKeys.has(stringify(row)),
				),
				extra: actual.filter(
					(row) => !expectedKeys.has(stringify(row)),
				),
			},
			null,
			2,
		),
	);
} finally {
	connection.closeSync();
	instance.closeSync();
}
