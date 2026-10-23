import { randomUUID } from "node:crypto";
import {
	copyFile,
	link,
	mkdir,
	readFile,
	readdir,
	rename,
	rm,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

/** Publish static archive paths without duplicating their storage. */
export async function linkBoundaryTiles(
	root = resolve("."),
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
		const temporary = `${target}.${randomUUID()}.tmp`;
		try {
			await link(join(source, release, "boundaries.pmtiles"), temporary);
			await rename(temporary, target);
		} finally {
			await rm(temporary, { force: true });
		}
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
	resolve(process.argv[1]) === resolve("scripts/link-boundary-tiles.ts")
) {
	void linkBoundaryTiles(
		undefined,
		process.argv[2] ? resolve(process.argv[2]) : undefined,
	).catch((error: unknown) => {
		console.error(error);
		process.exitCode = 1;
	});
}
