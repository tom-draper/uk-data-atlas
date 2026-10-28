import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";

export type Seal = {
	schemaVersion: 1;
	databaseSha256: string;
	postcodeIndex: string;
	postcodeAreas: string;
};

export function readSeal(path: string): Seal {
	const seal = JSON.parse(readFileSync(path, "utf8"));
	if (
		seal.schemaVersion !== 1 ||
		typeof seal.databaseSha256 !== "string" ||
		!/^[a-f0-9]{64}$/.test(seal.databaseSha256) ||
		![seal.postcodeIndex, seal.postcodeAreas].every(
			(value) =>
				typeof value === "string" &&
				/^sha256:[a-f0-9]{64}$/.test(value),
		)
	) {
		throw new Error("Invalid integrity seal");
	}
	return seal;
}

export async function fingerprint(path: string): Promise<string> {
	const checkJournals = () => {
		if (existsSync(`${path}-wal`) || existsSync(`${path}-journal`))
			throw new Error("Database has a WAL or rollback journal");
	};
	checkJournals();
	const before = statSync(path, { bigint: true });
	const hash = createHash("sha256");
	for await (const chunk of createReadStream(path)) hash.update(chunk);
	const after = statSync(path, { bigint: true });
	checkJournals();
	if (
		before.dev !== after.dev ||
		before.ino !== after.ino ||
		before.size !== after.size ||
		before.mtimeNs !== after.mtimeNs ||
		before.ctimeNs !== after.ctimeNs
	)
		throw new Error("Database changed while hashing");
	return hash.digest("hex");
}

export async function verifyFingerprint(
	path: string,
	expected: string,
): Promise<void> {
	if ((await fingerprint(path)) !== expected)
		throw new Error("Database fingerprint differs from integrity seal");
}
