import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeSqliteIndex } from "../src/sqliteIndex";

export const buildAtlasSqlite = (repositoryRoot: string) => {
	const directory = join(repositoryRoot, "compiled");
	mkdirSync(directory, { recursive: true });
	const path = join(directory, "atlas.sqlite");
	const payload = readFileSync(
		join(repositoryRoot, "services/api/public/terrain-catalogue.json"),
		"utf8",
	);
	writeSqliteIndex(
		path,
		{ schemaVersion: "1" },
		{
			payloads: {
				columns: ["id TEXT NOT NULL", "payload TEXT NOT NULL"],
				key: ["id"],
				rows: [["terrain-catalogue", payload]],
			},
		},
	);
	return path;
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const path = buildAtlasSqlite(resolve(dirname(scriptPath), "../../.."));
	console.log(`Wrote terrain catalogue to ${path}`);
}
