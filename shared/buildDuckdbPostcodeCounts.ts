import { join } from "node:path";
import { aggregateCounts } from "./duckdbPostcodeCounts";
import { compileDuckDBCounts } from "./compileDuckdbPostcodeCounts";
import { fingerprint, verifyFingerprint } from "./duckdbDatabaseIntegrity";
import { validateShards } from "./validatePostcodeCountInputs";
import { storePostcodeCounts } from "./storePostcodeCounts";

export async function buildDuckdbPostcodeCounts(root: string) {
	const database = join(root, "data/build/atlas.sqlite");
	const databaseSha256 = await fingerprint(database);
	const { index, areas } = validateShards(root);
	await verifyFingerprint(database, databaseSha256);
	const result = await aggregateCounts(database);
	const { artifact } = compileDuckDBCounts(index, areas, result);
	await verifyFingerprint(database, databaseSha256);
	const outputPath = storePostcodeCounts(root, artifact);
	const countedAreas = artifact.releases.reduce(
		(count, release) => count + Object.keys(release.areas).length,
		0,
	);
	return { outputPath, artifact, countedAreas };
}
