import { createReadStream } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import {
	link,
	mkdir,
	readFile,
	readdir,
	rename,
	rm,
	rmdir,
	stat,
	writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
	assertCompleteBoundaryResources,
	parseBoundaryResources,
} from "@uk-data-atlas/atlas-runtime/areas";

/** Publish only map resources and properties. Topologies stay private. */
export async function linkBoundaryTiles(
	root = resolve("."),
	destination = join(root, "public/data"),
) {
	const build = join(root, "data/build");
	const manifestPath = join(build, "boundaries/tiles.json");
	const manifestText = await readFile(manifestPath, "utf8");
	const manifest = parseBoundaryResources(JSON.parse(manifestText));
	assertCompleteBoundaryResources(manifest);
	const files: {
		source: string;
		relative: string;
		bytes: number | undefined;
		release: string;
	}[] = [];
	for (const [release, entry] of Object.entries(manifest.releases)) {
		const relative = entry.href.replace(/^\/data\//, "");
		const source = join(build, relative);
		const hash = createHash("sha256");
		for await (const chunk of createReadStream(source)) hash.update(chunk);
		const hashed = join(dirname(relative), `${hash.digest("hex")}.pmtiles`);
		files.push(
			{ source, relative: hashed, bytes: entry.bytes, release },
			// Retain the stable alias for one release, with revalidation.
			{
				source,
				relative: join(dirname(relative), "boundaries.pmtiles"),
				bytes: entry.bytes,
				release,
			},
			{
				source: join(build, dirname(relative), "properties.json"),
				relative: join(dirname(relative), "properties.json"),
				bytes: undefined,
				release,
			},
		);
		entry.href = `/data/${hashed.replaceAll("\\", "/")}`;
	}
	// Validate the whole generation before changing any public files.
	for (const file of files) {
		const built = await stat(file.source);
		if (
			!built.isFile() ||
			(file.bytes !== undefined && built.size !== file.bytes)
		)
			throw new Error(
				`Boundary resource does not match manifest: ${file.release}`,
			);
	}
	for (const { source, relative } of files) {
		const target = join(destination, relative);
		await mkdir(dirname(target), { recursive: true });
		const temporary = `${target}.${randomUUID()}.tmp`;
		try {
			await link(source, temporary);
			await rename(temporary, target);
		} finally {
			await rm(temporary, { force: true });
		}
	}
	const boundaryDirectory = join(destination, "boundaries");
	const current = new Set(
		files.map(({ relative }) =>
			relative.replace(/^boundaries\//, "").replaceAll("\\", "/"),
		),
	);
	for (const file of await readdir(boundaryDirectory, { recursive: true })) {
		const normal = file.replaceAll("\\", "/");
		if (
			normal.endsWith(".topojson") ||
			normal.endsWith(".topojson.gz") ||
			normal.endsWith("/boundaries.untiled.json") ||
			(/\.(?:pmtiles|geojson)$/.test(normal) &&
				!/[a-f0-9]{64}\.pmtiles$/.test(normal) &&
				!current.has(normal)) ||
			(normal.endsWith("/properties.json") && !current.has(normal)) ||
			normal.includes("/chunks/")
		)
			await rm(join(boundaryDirectory, file), { force: true });
	}
	const directories = await readdir(boundaryDirectory, { recursive: true });
	directories.sort(
		(a, b) => b.split(/[\\/]/).length - a.split(/[\\/]/).length,
	);
	for (const directory of directories) {
		const path = join(boundaryDirectory, directory);
		if (
			(await stat(path)).isDirectory() &&
			(await readdir(path)).length === 0
		)
			await rmdir(path);
	}
	const temporary = join(boundaryDirectory, `tiles.${randomUUID()}.tmp`);
	try {
		await writeFile(temporary, `${JSON.stringify(manifest, null, "\t")}\n`);
		await rename(temporary, join(boundaryDirectory, "tiles.json"));
	} finally {
		await rm(temporary, { force: true });
	}
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
