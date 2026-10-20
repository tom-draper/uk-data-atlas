import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";

const script = resolve("scripts/simplify-boundary-source.mts");

for (const geometryType of ["Polygon", "MultiPolygon"]) {
	test(`rejects a ${geometryType} ring that rounds to [a,b,a,a] without writing output`, () => {
		const root = mkdtempSync(join(tmpdir(), "simplify-boundary-"));
		try {
			const input = join(root, "input.geojson");
			const output = join(root, "output.geojson");
			const ring = [
				[0, 0],
				[1, 0],
				[0.00000001, 0.00000001],
				[0, 0],
			];
			writeFileSync(
				input,
				JSON.stringify({
					type: "FeatureCollection",
					features: [
						{
							type: "Feature",
							properties: { code: "tiny" },
							geometry: {
								type: geometryType,
								coordinates:
									geometryType === "Polygon"
										? [ring]
										: [[ring]],
							},
						},
					],
				}),
			);
			const run = () =>
				spawnSync(
					process.execPath,
					["--import", "tsx", script, input, output, "--keep", "1"],
					{ encoding: "utf8" },
				);
			const result = run();
			expect(result.status).toBe(1);
			expect(result.stderr).toContain(
				"Simplification produced 1 degenerate rings",
			);
			expect(existsSync(output)).toBe(false);
			writeFileSync(output, "existing output");
			expect(run().status).toBe(1);
			expect(readFileSync(output, "utf8")).toBe("existing output");
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
}

test("writes a valid triangle with three distinct vertices", () => {
	const root = mkdtempSync(join(tmpdir(), "simplify-boundary-"));
	try {
		const input = join(root, "input.geojson");
		const output = join(root, "output.geojson");
		const source = {
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					properties: { code: "triangle" },
					geometry: {
						type: "Polygon",
						coordinates: [
							[
								[0, 0],
								[1, 0],
								[0, 1],
								[0, 0],
							],
						],
					},
				},
			],
		};
		writeFileSync(input, JSON.stringify(source));
		const result = spawnSync(
			process.execPath,
			["--import", "tsx", script, input, output, "--keep", "1"],
			{ encoding: "utf8" },
		);
		expect(result.status, result.stderr).toBe(0);
		expect(JSON.parse(readFileSync(output, "utf8"))).toEqual(source);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
