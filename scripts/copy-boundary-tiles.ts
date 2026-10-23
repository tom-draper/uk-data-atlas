import { copyFile, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Publish the website's built archives at their existing static URLs. */
export async function copyBoundaryTiles(
	root = resolve(import.meta.dirname, ".."),
	destination = join(root, "public/data"),
) {
	const source = join(root, "data/build/boundaries");
	const manifest: { releases: Record<string, unknown> } = JSON.parse(
		await readFile(join(source, "tiles.json"), "utf8"),
	);
	for (const release of Object.keys(manifest.releases)) {
		const target = join(
			destination,
			"boundaries",
			release,
			"boundaries.pmtiles",
		);
		await mkdir(dirname(target), { recursive: true });
		await copyFile(join(source, release, "boundaries.pmtiles"), target);
	}
	const boundaryDirectory = join(destination, "boundaries");
	await mkdir(boundaryDirectory, { recursive: true });
	const current = new Set(
		Object.keys(manifest.releases).map(
			(release) => `${release}/boundaries.pmtiles`,
		),
	);
	for (const file of await readdir(boundaryDirectory, { recursive: true })) {
		if (
			file.endsWith(".pmtiles") &&
			!current.has(file.replaceAll("\\", "/"))
		)
			await rm(join(boundaryDirectory, file));
	}
	await copyFile(
		join(source, "tiles.json"),
		join(destination, "boundaries/tiles.json"),
	);
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	await copyBoundaryTiles();
}
