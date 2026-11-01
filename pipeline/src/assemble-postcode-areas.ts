import { randomUUID } from "node:crypto";
import { copyFileSync, readFileSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
	artifactDirectory,
	writePostcodeAreas,
} from "@uk-data-atlas/atlas-runtime/storage";
import type { PostcodeAreasArtifact } from "@uk-data-atlas/geography/postcode-area-types";
import {
	postcodeAreasDirectory,
	readPostcodeAreaComponent,
} from "./storePostcodeAreas";

export function assemblePostcodeAreas(root: string) {
	const path = join(root, "data/build/atlas.sqlite");
	const artifact = JSON.parse(
		readFileSync(
			join(postcodeAreasDirectory(root), "manifest.json"),
			"utf8",
		),
	) as PostcodeAreasArtifact;
	const temporary = `${path}.postcode-areas.${randomUUID()}.tmp`;
	try {
		copyFileSync(path, temporary);
		const database = new DatabaseSync(temporary);
		try {
			database.exec("PRAGMA foreign_keys = ON; BEGIN");
			writePostcodeAreas(database, artifact, (name) =>
				readPostcodeAreaComponent(root, name),
			);
			database
				.prepare("INSERT OR REPLACE INTO payloads VALUES (?, ?)")
				.run("postcode-areas", JSON.stringify(artifact));
			database.exec("COMMIT; VACUUM");
		} finally {
			database.close();
		}
		renameSync(temporary, path);
	} finally {
		rmSync(temporary, { force: true });
	}
	const publicRoot = artifactDirectory(root);
	rmSync(join(publicRoot, "postcode-areas"), {
		recursive: true,
		force: true,
	});
	for (const name of ["postcode-areas.json", "postcode-areas.json.gz"])
		rmSync(join(publicRoot, name), { force: true });
	return path;
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath)
	console.log(
		`Assembled postcode areas into ${assemblePostcodeAreas(resolve(dirname(scriptPath), "../.."))}`,
	);
