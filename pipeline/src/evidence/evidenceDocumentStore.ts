import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sha256 } from "@uk-data-atlas/artifacts";
import { publicJson } from "@uk-data-atlas/atlas-runtime/storage";
import type { EvidenceDocument } from "@uk-data-atlas/atlas-runtime/catalogue";

export const writeEvidenceDocument = (
	directory: string,
	id: string,
	data: unknown,
): EvidenceDocument => {
	const artifact = `documents/${id}.json`;
	const body = `${publicJson({ schemaVersion: 1, data })}\n`;
	mkdirSync(join(directory, "documents"), { recursive: true });
	writeFileSync(join(directory, artifact), body);
	return {
		id,
		artifact,
		bytes: Buffer.byteLength(body),
		contentHash: sha256(body),
	};
};

export const cachedEvidenceMeasure = (
	directory: string,
	id: string,
	sourceHash: string,
	compilerHash: string,
): EvidenceDocument | undefined => {
	const artifact = `documents/measure-${id}.json`;
	const path = join(directory, artifact);
	if (!existsSync(path)) return undefined;
	const body = readFileSync(path, "utf8");
	const existing: { data: { compilerHash?: string; inputsHash?: string } } =
		JSON.parse(body);
	if (
		existing.data.compilerHash !== compilerHash ||
		existing.data.inputsHash !== sourceHash
	)
		return undefined;
	return {
		id: `measure-${id}`,
		artifact,
		bytes: Buffer.byteLength(body),
		contentHash: sha256(body),
	};
};
