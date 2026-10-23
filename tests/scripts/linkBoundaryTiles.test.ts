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
import { join } from "node:path";
import { expect, onTestFinished, test } from "vitest";
import { linkBoundaryTiles } from "@/scripts/link-boundary-tiles";

test("shares archive storage, repairs old copies and removes obsolete tiles while retaining topology", async () => {
	const root = await mkdtemp(join(tmpdir(), "boundary-publish-"));
	onTestFinished(() => rm(root, { recursive: true, force: true }));
	const source = join(root, "data/build/boundaries");
	const target = join(root, "public/data/boundaries");
	await mkdir(join(source, "ward/current"), { recursive: true });
	await mkdir(join(target, "ward/old"), { recursive: true });
	const bytes = Buffer.from([80, 77, 0, 255]);
	const manifest = JSON.stringify({
		minZoom: 0,
		maxZoom: 10,
		releases: {
			"ward/current": {
				href: "/data/boundaries/ward/current/boundaries.pmtiles",
				bytes: 4,
			},
		},
		untiled: {},
	});
	await writeFile(join(source, "tiles.json"), manifest);
	await writeFile(join(source, "ward/current/boundaries.pmtiles"), bytes);
	await writeFile(join(target, "ward/old/boundaries.pmtiles"), "old");
	await writeFile(join(target, "ward/old/boundaries.json"), "topology");
	await mkdir(join(target, "ward/current"), { recursive: true });
	await writeFile(
		join(target, "ward/current/boundaries.pmtiles"),
		"old copy",
	);
	await linkBoundaryTiles(root);
	await linkBoundaryTiles(root);
	const original = await stat(
		join(source, "ward/current/boundaries.pmtiles"),
	);
	const published = await stat(
		join(target, "ward/current/boundaries.pmtiles"),
	);
	expect(published.dev).toBe(original.dev);
	expect(published.ino).toBe(original.ino);
	expect(original.nlink).toBe(2);
	await writeFile(join(source, "ward/current/replacement.pmtiles"), bytes);
	await rename(
		join(source, "ward/current/replacement.pmtiles"),
		join(source, "ward/current/boundaries.pmtiles"),
	);
	await linkBoundaryTiles(root);
	expect(
		(await stat(join(target, "ward/current/boundaries.pmtiles"))).ino,
	).toBe((await stat(join(source, "ward/current/boundaries.pmtiles"))).ino);
	expect(
		await readFile(join(target, "ward/current/boundaries.pmtiles")),
	).toEqual(bytes);
	expect(await readFile(join(target, "tiles.json"), "utf8")).toBe(manifest);
	expect(
		await readFile(join(target, "ward/old/boundaries.json"), "utf8"),
	).toBe("topology");
	await expect(
		stat(join(target, "ward/old/boundaries.pmtiles")),
	).rejects.toMatchObject({ code: "ENOENT" });
});
