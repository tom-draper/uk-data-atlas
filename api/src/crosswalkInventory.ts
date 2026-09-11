import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
	CrosswalkAdapter,
	CrosswalkSideAdapter,
} from "./crosswalkAdapters";

type FeatureCollection = {
	type?: unknown;
	features?: Array<{ properties?: unknown }>;
};

export type CrosswalkArea = {
	code: string;
	labels: string[];
};

export type CrosswalkArtifact = {
	schemaVersion: 1;
	contentHash: string;
	id: string;
	method: "official-lookup";
	quality: "publisher-supplied";
	weighting: { status: "not-provided" };
	from: { geography: string; boundaryRelease: string };
	to: { geography: string; boundaryRelease: string };
	provenance: { input: string; inputHash: string };
	validation: {
		sourceNameConflicts: Array<{ code: string; names: string[] }>;
	};
	records: Array<{ source: CrosswalkArea; targets: CrosswalkArea[] }>;
};

export type CrosswalkInventory = {
	schemaVersion: 1;
	contentHash: string;
	crosswalks: Array<{
		id: string;
		from: { geography: string; boundaryRelease: string };
		to: { geography: string; boundaryRelease: string };
		method: "official-lookup";
		quality: "publisher-supplied";
		weighting: { status: "not-provided" };
		recordCount: number;
		artifact: string;
		contentHash: string;
	}>;
};

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const stringValue = (value: unknown, description: string): string => {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`Missing ${description}`);
	}
	return value.trim();
};

const area = (
	properties: Record<string, unknown>,
	side: CrosswalkSideAdapter,
	input: string,
	index: number,
): CrosswalkArea => {
	const code = stringValue(
		properties[side.codeProperty],
		`${side.codeProperty} at ${input} feature ${index}`,
	);
	const name = stringValue(
		properties[side.nameProperty],
		`${side.nameProperty} at ${input} feature ${index}`,
	);
	const alias = side.aliasProperty
		? properties[side.aliasProperty]
		: undefined;
	return {
		code,
		labels: [name, ...(typeof alias === "string" ? [alias.trim()] : [])]
			.filter(Boolean)
			.sort(),
	};
};

const mergeArea = (
	left: CrosswalkArea,
	right: CrosswalkArea,
): CrosswalkArea => ({
	code: left.code,
	labels: [...new Set([...left.labels, ...right.labels])].sort(),
});

export const compileCrosswalks = (
	repositoryRoot: string,
	adapters: CrosswalkAdapter[],
): { inventory: CrosswalkInventory; artifacts: CrosswalkArtifact[] } => {
	const artifacts = adapters.map((adapter) => {
		const inputPath = join(repositoryRoot, "data", adapter.input);
		const input = readFileSync(inputPath, "utf8");
		const source = JSON.parse(input) as FeatureCollection;
		if (
			source.type !== "FeatureCollection" ||
			!Array.isArray(source.features)
		) {
			throw new Error(
				`${adapter.id}: input is not a GeoJSON FeatureCollection`,
			);
		}
		const records = new Map<
			string,
			{ source: CrosswalkArea; targets: Map<string, CrosswalkArea> }
		>();
		const sourcePrimaryNames = new Map<string, Set<string>>();
		for (const [index, feature] of source.features.entries()) {
			if (
				typeof feature.properties !== "object" ||
				feature.properties === null
			) {
				throw new Error(
					`${adapter.id}: feature ${index} has no properties`,
				);
			}
			const properties = feature.properties as Record<string, unknown>;
			const sourceArea = area(
				properties,
				adapter.from,
				adapter.id,
				index,
			);
			const targetArea = area(properties, adapter.to, adapter.id, index);
			const sourceName = stringValue(
				properties[adapter.from.nameProperty],
				`${adapter.from.nameProperty} at ${adapter.id} feature ${index}`,
			);
			const names =
				sourcePrimaryNames.get(sourceArea.code) ?? new Set<string>();
			names.add(sourceName);
			sourcePrimaryNames.set(sourceArea.code, names);
			const record = records.get(sourceArea.code);
			const targets = record?.targets ?? new Map<string, CrosswalkArea>();
			const existingTarget = targets.get(targetArea.code);
			targets.set(
				targetArea.code,
				existingTarget
					? mergeArea(existingTarget, targetArea)
					: targetArea,
			);
			records.set(sourceArea.code, {
				source: record
					? mergeArea(record.source, sourceArea)
					: sourceArea,
				targets,
			});
		}
		const sourceNameConflicts = [...sourcePrimaryNames.entries()]
			.filter(([, names]) => names.size > 1)
			.map(([code, names]) => ({ code, names: [...names].sort() }))
			.sort((left, right) => left.code.localeCompare(right.code));
		const artifactWithoutHash = {
			schemaVersion: 1 as const,
			id: adapter.id,
			method: "official-lookup" as const,
			quality: "publisher-supplied" as const,
			weighting: { status: "not-provided" as const },
			from: {
				geography: adapter.from.geography,
				boundaryRelease: adapter.from.boundaryRelease,
			},
			to: {
				geography: adapter.to.geography,
				boundaryRelease: adapter.to.boundaryRelease,
			},
			provenance: { input: adapter.input, inputHash: sha256(input) },
			validation: { sourceNameConflicts },
			records: [...records.values()]
				.map((record) => ({
					source: record.source,
					targets: [...record.targets.values()].sort((left, right) =>
						left.code.localeCompare(right.code),
					),
				}))
				.sort((left, right) =>
					left.source.code.localeCompare(right.source.code),
				),
		};
		return {
			...artifactWithoutHash,
			contentHash: sha256(JSON.stringify(artifactWithoutHash)),
		};
	});
	const crosswalks = artifacts.map((artifact) => ({
		id: artifact.id,
		from: artifact.from,
		to: artifact.to,
		method: artifact.method,
		quality: artifact.quality,
		weighting: artifact.weighting,
		recordCount: artifact.records.length,
		artifact: `crosswalks/${artifact.id}.json`,
		contentHash: artifact.contentHash,
	}));
	const content = JSON.stringify({ schemaVersion: 1, crosswalks });
	return {
		inventory: {
			schemaVersion: 1,
			contentHash: sha256(content),
			crosswalks,
		},
		artifacts,
	};
};
