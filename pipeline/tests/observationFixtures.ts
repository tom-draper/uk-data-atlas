import { basename } from "node:path";
import { writeFileSync } from "node:fs";

export const fixtureObservationDatabase = (directory: string) => directory;

export function writeObservationFixture(path: string, text: string) {
	const artifact = JSON.parse(text);
	writeFileSync(
		path,
		`${JSON.stringify(artifact.kind === "measure-table" ? { ...artifact, id: basename(path, ".json") } : artifact)}\n`,
	);
}
