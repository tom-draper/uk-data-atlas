import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { open, readFile, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";
import {
	assertCompleteBoundaryResources,
	parseBoundaryResources,
	websiteBoundaryReleases,
} from "@uk-data-atlas/atlas-runtime/areas";

const root = process.cwd();
const boundaryDirectory = join(root, "public/data/boundaries");

test("every served release has a PMTiles archive and properties without public topology", async () => {
	const manifest = parseBoundaryResources(
		JSON.parse(
			await readFile(join(boundaryDirectory, "tiles.json"), "utf8"),
		),
	);
	assertCompleteBoundaryResources(manifest);
	expect(Object.keys(manifest.releases).sort()).toEqual(
		websiteBoundaryReleases()
			.map(({ key }) => key)
			.sort(),
	);
	for (const [release, entry] of Object.entries(manifest.releases)) {
		expect(entry.href, release).toMatch(/\/[a-f0-9]{64}\.pmtiles$/);
		const path = join(root, "public", entry.href);
		const hash = createHash("sha256");
		for await (const chunk of createReadStream(path)) hash.update(chunk);
		expect(entry.href, release).toContain(`/${hash.digest("hex")}.pmtiles`);
		const file = await open(path, "r");
		try {
			const header = Buffer.alloc(127);
			await file.read(header, 0, 127, 0);
			expect(header.subarray(0, 7).toString("ascii"), release).toBe(
				"PMTiles",
			);
			expect(header[7], release).toBe(3);
			expect(header[100], release).toBe(manifest.minZoom);
			expect(header[101], release).toBe(manifest.maxZoom);
			expect((await file.stat()).size, release).toBe(entry.bytes);
		} finally {
			await file.close();
		}
		const properties = JSON.parse(
			await readFile(join(dirname(path), "properties.json"), "utf8"),
		);
		expect(properties.features.length, release).toBeGreaterThan(0);
		const stored = join(
			root,
			"data/build",
			entry.href
				.replace(/^\/data\//, "")
				.replace(/[a-f0-9]{64}\.pmtiles$/, "boundaries.pmtiles"),
		);
		expect((await stat(path)).ino, release).toBe((await stat(stored)).ino);
	}
	const files = await readdir(boundaryDirectory, { recursive: true });
	expect(files.filter((file) => /\.topojson(?:\.gz)?$/.test(file))).toEqual(
		[],
	);
	expect(
		files.filter(
			(file) =>
				file.replaceAll("\\", "/").includes("/chunks/") &&
				file.endsWith(".json"),
		),
	).toEqual([]);
});
