import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
	fingerprint,
	readSeal,
	verifyFingerprint,
} from "../../shared/duckdbDatabaseIntegrity";

const dir = mkdtempSync(join(tmpdir(), "atlas-integrity-test-"));
try {
	const path = join(dir, "atlas.sqlite");
	const db = new DatabaseSync(path);
	db.exec(
		"CREATE TABLE postcodes (postcode TEXT, largeUser INTEGER); INSERT INTO postcodes VALUES ('AB1 1AA', 0)",
	);
	db.close();
	const trusted = await fingerprint(path);
	const sealPath = join(dir, "seal.json");
	writeFileSync(
		sealPath,
		JSON.stringify({
			schemaVersion: 1,
			databaseSha256: trusted,
			postcodeIndex: `sha256:${trusted}`,
			postcodeAreas: `sha256:${trusted}`,
		}),
	);
	assert.equal(readSeal(sealPath).databaseSha256, trusted);
	await verifyFingerprint(path, trusted);
	const changed = new DatabaseSync(path);
	changed.exec("UPDATE postcodes SET largeUser = 1");
	changed.close();
	await assert.rejects(
		verifyFingerprint(path, trusted),
		/fingerprint differs/,
	);
	writeFileSync(`${path}-wal`, "");
	await assert.rejects(fingerprint(path), /WAL or rollback journal/);
	console.log("Integrity tests passed");
} finally {
	rmSync(dir, { recursive: true, force: true });
}
