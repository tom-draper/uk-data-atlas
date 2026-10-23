import {
	mkdtemp,
	mkdir,
	readFile,
	writeFile,
	rm,
	stat,
	rename,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, onTestFinished, test } from "vitest";
import { linkBoundaryTiles } from "@/scripts/link-boundary-tiles";
import { websiteBoundaryReleases } from "@/shared/boundaryResources";

async function fixture() {
	const root = await mkdtemp(join(tmpdir(), "boundary-publish-"));
	onTestFinished(() => rm(root, { recursive: true, force: true }));
	const source = join(root, "data/build");
	const target = join(root, "public/data");
	const bytes = Buffer.from([80, 77, 0, 255]);
	const releases = Object.fromEntries(
		await Promise.all(
			websiteBoundaryReleases().map(async ({ key, asset }) => {
				const href = asset.replace(".topojson", ".pmtiles");
				const relative = href.replace(/^\/data\//, "");
				await mkdir(dirname(join(source, relative)), {
					recursive: true,
				});
				await writeFile(join(source, relative), bytes);
				const properties = join(
					source,
					dirname(relative),
					"properties.json",
				);
				await mkdir(dirname(properties), { recursive: true });
				await writeFile(properties, '{"features":[]}');
				return [
					key,
					{ method: "shared-arcs", href, bytes: bytes.length },
				];
			}),
		),
	);
	const manifest = JSON.stringify({
		schemaVersion: 2,
		minZoom: 0,
		maxZoom: 12,
		releases,
	});
	await writeFile(join(source, "boundaries/tiles.json"), manifest);
	return { root, source, target, bytes, manifest };
}

test("publishes a complete generation, preserves hard links and removes legacy geometry", async () => {
	const { root, source, target, bytes, manifest } = await fixture();
	const directory = "boundaries/local-authority/2024-12-uk-bgc";
	const archive = `${directory}/boundaries.pmtiles`;
	await mkdir(join(target, directory, "chunks"), { recursive: true });
	await writeFile(join(target, archive), "old copy");
	for (const file of [
		"boundaries.topojson",
		"boundaries.topojson.gz",
		"chunks/E12000001.topojson",
		"chunks/index.json",
		"old.geojson",
	])
		await writeFile(join(target, directory, file), "legacy");
	await mkdir(join(target, "boundaries/ward/obsolete"), { recursive: true });
	await writeFile(
		join(target, "boundaries/ward/obsolete/properties.json"),
		"stale",
	);
	await linkBoundaryTiles(root);
	await linkBoundaryTiles(root);
	expect((await stat(join(target, archive))).ino).toBe(
		(await stat(join(source, archive))).ino,
	);
	expect(
		await readFile(join(target, directory, "properties.json"), "utf8"),
	).toBe('{"features":[]}');
	expect(await readFile(join(target, "boundaries/tiles.json"), "utf8")).toBe(
		manifest,
	);
	for (const file of [
		"boundaries.topojson",
		"boundaries.topojson.gz",
		"chunks/E12000001.topojson",
		"chunks/index.json",
		"old.geojson",
	])
		await expect(stat(join(target, directory, file))).rejects.toMatchObject(
			{ code: "ENOENT" },
		);
	await expect(stat(join(target, directory, "chunks"))).rejects.toMatchObject(
		{ code: "ENOENT" },
	);
	await expect(
		stat(join(target, "boundaries/ward/obsolete")),
	).rejects.toMatchObject({ code: "ENOENT" });
	await writeFile(join(source, `${archive}.new`), bytes);
	await rename(join(source, `${archive}.new`), join(source, archive));
	await linkBoundaryTiles(root);
	expect((await stat(join(target, archive))).ino).toBe(
		(await stat(join(source, archive))).ino,
	);
	expect(await readFile(join(target, archive))).toEqual(bytes);
});

test("refuses incomplete or corrupt generations before deleting any legacy data", async () => {
	const { root, source, target, manifest } = await fixture();
	const directory = join(target, "boundaries/ward/old");
	await mkdir(directory, { recursive: true });
	await writeFile(join(directory, "boundaries.topojson"), "keep");
	const broken = JSON.parse(manifest);
	delete broken.releases["ward/2026-05-uk-bgc"];
	await writeFile(
		join(source, "boundaries/tiles.json"),
		JSON.stringify(broken),
	);
	await expect(linkBoundaryTiles(root)).rejects.toThrow(
		"Missing boundary map resource",
	);
	await writeFile(join(source, "boundaries/tiles.json"), manifest);
	await writeFile(
		join(source, "boundaries/ward/2026-05-uk-bgc/boundaries.pmtiles"),
		"wrong size",
	);
	await expect(linkBoundaryTiles(root)).rejects.toThrow(
		"does not match manifest",
	);
	expect(await readFile(join(directory, "boundaries.topojson"), "utf8")).toBe(
		"keep",
	);
	await expect(
		stat(join(target, "boundaries/tiles.json")),
	).rejects.toMatchObject({ code: "ENOENT" });
});
