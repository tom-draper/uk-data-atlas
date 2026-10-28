import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { strict as assert } from "node:assert";
import {
	loadRoadCollisionsByAuthority,
	ROAD_COLLISION_SOURCES,
} from "../../packages/datasets/src/data/road-safety/authorityLoader";
import { compileDuckdbRoadCollisions } from "../../pipeline/src/precompile/duckdbRoadCollisions.mts";

let root = "";
afterEach(async () => {
	if (root) await rm(root, { recursive: true, force: true });
});
const header =
	"collision_index,local_authority_ons_district,lsoa_of_accident_location,collision_severity,date\n";
const valid = (year: number) =>
	header +
	`a,E06000001,E01000001,1,01/01/${year}\nb,W06000001,,2,01/02/${year}\nc,EHEATHROW,E01000001,3,01/02/${year}\n`;

test("DuckDB matches the collision loader and rejects invalid sources", async () => {
	root = await mkdtemp(join(tmpdir(), "road-collisions-"));
	await mkdir(join(root, "transport/road-safety"), { recursive: true });
	const writeSources = async (first: string, second: string) => {
		await Promise.all(
			[first, second].map((value, index) =>
				writeFile(join(root, ROAD_COLLISION_SOURCES[index]!), value),
			),
		);
	};
	await writeSources(valid(2024), valid(2025));
	const artifacts = new Map();
	const expected = await loadRoadCollisionsByAuthority((path) =>
		readFile(join(root, path), "utf8"),
	);
	const actual = await compileDuckdbRoadCollisions(artifacts, root);
	assert.equal(JSON.stringify(actual), JSON.stringify(expected));
	assert.equal(artifacts.size, 2);
	for (const [first, second] of [
		[valid(2024).replace(",1,01/01/2024", ",9,01/01/2024"), valid(2025)],
		[valid(2024).replace("01/01/2024", "bad"), valid(2025)],
		[valid(2024).replace("01/02/2024", "01/02/2023"), valid(2025)],
		[valid(2024).replaceAll("01/02/2024", "01/03/2024"), valid(2025)],
		[header, valid(2025)],
		[valid(2024), valid(2024)],
	]) {
		await writeSources(first!, second!);
		await assert.rejects(
			loadRoadCollisionsByAuthority((path) =>
				readFile(join(root, path), "utf8"),
			),
		);
		await assert.rejects(compileDuckdbRoadCollisions(new Map(), root));
	}
	await rm(join(root, ROAD_COLLISION_SOURCES[0]!));
	await assert.rejects(compileDuckdbRoadCollisions(new Map(), root), {
		code: "ENOENT",
	});
});
