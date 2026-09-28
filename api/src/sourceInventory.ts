import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

export type SourceFile = {
	extension: string;
	role?: string;
};

export type SourceInventoryRecord = {
	key: string;
	metadataId?: string;
	kind?: string;
	title?: string;
	publisher?: string;
	sourceUrl?: string;
	temporalCoverage?: string;
	files: SourceFile[];
	metadataHash: string;
};

export type SourceInventory = {
	schemaVersion: 1;
	contentHash: string;
	sources: SourceInventoryRecord[];
};

type Metadata = {
	id?: unknown;
	kind?: unknown;
	title?: unknown;
	publisher?: unknown;
	sourceUrl?: unknown;
	temporalCoverage?: unknown;
	files?: unknown;
};

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const optionalString = (value: unknown): string | undefined =>
	typeof value === "string" && value.length > 0 ? value : undefined;

const metadataPaths = (directory: string): string[] =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return metadataPaths(path);
		return entry.name === "meta.json" ? [path] : [];
	});

const sourceFiles = (value: unknown): SourceFile[] => {
	if (!Array.isArray(value)) return [];
	return value.flatMap((file) => {
		if (typeof file !== "object" || file === null) return [];
		const path = optionalString((file as { path?: unknown }).path);
		if (!path) return [];
		const extension = path.includes(".")
			? path.slice(path.lastIndexOf(".")).toLowerCase()
			: "";
		const role = optionalString((file as { role?: unknown }).role);
		return [{ extension, ...(role === undefined ? {} : { role }) }];
	});
};

export const createSourceInventory = (
	repositoryRoot: string,
): SourceInventory => {
	const dataRoot = join(repositoryRoot, "data");
	const sources = metadataPaths(dataRoot)
		.map((metadataPath) => {
			const raw = readFileSync(metadataPath, "utf8");
			const metadata = JSON.parse(raw) as Metadata;
			return {
				key: relative(dataRoot, join(metadataPath, "..")).replaceAll(
					"\\",
					"/",
				),
				...(optionalString(metadata.id) === undefined
					? {}
					: { metadataId: optionalString(metadata.id) }),
				...(optionalString(metadata.kind) === undefined
					? {}
					: { kind: optionalString(metadata.kind) }),
				...(optionalString(metadata.title) === undefined
					? {}
					: { title: optionalString(metadata.title) }),
				...(optionalString(metadata.publisher) === undefined
					? {}
					: { publisher: optionalString(metadata.publisher) }),
				...(optionalString(metadata.sourceUrl) === undefined
					? {}
					: { sourceUrl: optionalString(metadata.sourceUrl) }),
				...(optionalString(metadata.temporalCoverage) === undefined
					? {}
					: {
							temporalCoverage: optionalString(
								metadata.temporalCoverage,
							),
						}),
				files: sourceFiles(metadata.files),
				metadataHash: sha256(raw),
			};
		})
		.sort((left, right) => left.key.localeCompare(right.key));
	const content = JSON.stringify({ schemaVersion: 1, sources });

	return { schemaVersion: 1, contentHash: sha256(content), sources };
};
