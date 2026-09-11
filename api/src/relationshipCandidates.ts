import { createHash } from "node:crypto";
import {
	closeSync,
	existsSync,
	openSync,
	readFileSync,
	readSync,
} from "node:fs";
import { join } from "node:path";
import { readDbfRecords } from "./dbf";
import type { AreaReleaseArtifact } from "./areaInventory";

type FeatureCollection = {
	type?: unknown;
	features?: Array<{ properties?: unknown }>;
};

type BoundaryMetadata = {
	files?: unknown;
};

type CandidateSide = {
	geography: string;
	boundaryRelease: string;
	codeProperty: string;
	nameProperty: string;
};

type CandidateTarget =
	| CandidateSide
	| {
			geography?: string;
			codeProperty: string;
			nameProperty: string;
	  };

export type RelationshipCandidate = {
	id: string;
	input: string;
	from: CandidateSide;
	to: CandidateTarget;
	status: "eligible" | "needs-review" | "not-available";
	publishedCrosswalkId?: string;
	validation: {
		endpoints: {
			from: {
				status: "verified";
				availableAreaCount: number;
				referencedCodeCount: number;
			};
			to:
				| {
						status: "verified";
						availableAreaCount: number;
						referencedCodeCount: number;
				  }
				| { status: "not-available"; reason: string };
		};
		relationship: {
			sourceFeatureCount: number;
			sourceCodeCount: number;
			targetCodeCount: number;
			multiTargetSourceCount: number;
			missingValueFeatureCount: number;
		};
		reasons: string[];
	};
};

export type RelationshipCandidateInventory = {
	schemaVersion: 1;
	contentHash: string;
	candidates: RelationshipCandidate[];
};

export type PublishedRelationship = {
	id: string;
	from: { geography: string; boundaryRelease: string };
	to: { geography: string; boundaryRelease: string };
};

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const toKebabCase = (value: string) =>
	value.replaceAll(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

const stringValue = (value: unknown) =>
	typeof value === "string" && value.trim().length > 0
		? value.trim()
		: undefined;

const propertyStem = (key: string, suffix: "code" | "name") =>
	key
		.replace(suffix === "code" ? /(?:cd|code)$/i : /(?:nm|name)$/i, "")
		.toLowerCase();

const propertyFamily = (key: string, suffix: "code" | "name") =>
	propertyStem(key, suffix).replace(/\d+$/, "");

const propertyPairs = (properties: Record<string, unknown>) => {
	const keys = Object.keys(properties);
	const codeKeys = keys.filter((key) => /(?:cd|code)$/i.test(key));
	const nameKeys = keys.filter((key) => /(?:nm|name)$/i.test(key));
	return codeKeys.flatMap((codeProperty) => {
		const stem = propertyStem(codeProperty, "code");
		return nameKeys
			.filter(
				(nameProperty) => propertyStem(nameProperty, "name") === stem,
			)
			.map((nameProperty) => ({ codeProperty, nameProperty }));
	});
};

const sourcePaths = (directory: string) => {
	const metadata = JSON.parse(
		readFileSync(join(directory, "meta.json"), "utf8"),
	) as BoundaryMetadata;
	if (!Array.isArray(metadata.files)) return {};
	const source = metadata.files.find(
		(candidate) =>
			typeof candidate === "object" &&
			candidate !== null &&
			(candidate as { role?: unknown }).role === "source" &&
			typeof (candidate as { path?: unknown }).path === "string",
	) as { path: string } | undefined;
	if (!source) return {};
	const path = join(directory, source.path);
	if (source.path.toLowerCase().endsWith(".geojson"))
		return { geoJsonPath: path };
	if (source.path.toLowerCase().endsWith(".shp")) {
		return { dbfPath: path.replace(/\.shp$/i, ".dbf") };
	}
	return {};
};

const sourceFor = (repositoryRoot: string, artifact: AreaReleaseArtifact) => {
	const source = artifact.derivedFrom?.source;
	const geography = source?.geography ?? artifact.geography;
	const boundaryRelease = source?.boundaryRelease ?? artifact.boundaryRelease;
	const directory = join(
		repositoryRoot,
		"data",
		"boundaries",
		toKebabCase(geography),
		boundaryRelease,
	);
	const paths = sourcePaths(directory);
	const path = paths.geoJsonPath ?? paths.dbfPath;
	if (!path || !existsSync(path)) return undefined;
	return {
		path,
		input: join(
			"boundaries",
			toKebabCase(geography),
			boundaryRelease,
			path.slice(directory.length + 1),
		),
	};
};

const readProperties = (path: string) => {
	if (path.toLowerCase().endsWith(".dbf")) return readDbfRecords(path);
	const source = JSON.parse(readFileSync(path, "utf8")) as FeatureCollection;
	if (
		source.type !== "FeatureCollection" ||
		!Array.isArray(source.features)
	) {
		throw new Error(`${path}: source is not a GeoJSON FeatureCollection`);
	}
	return source.features.map((feature, index) => {
		if (
			typeof feature.properties !== "object" ||
			feature.properties === null
		) {
			throw new Error(`${path}: feature ${index} has no properties`);
		}
		return feature.properties as Record<string, unknown>;
	});
};

const firstGeoJsonProperties = (path: string) => {
	const descriptor = openSync(path, "r");
	const buffer = Buffer.alloc(2 * 1024 * 1024);
	const bytesRead = readSync(descriptor, buffer, 0, buffer.length, 0);
	closeSync(descriptor);
	const header = buffer.subarray(0, bytesRead).toString("utf8");
	const features = header.indexOf('"features":[');
	const marker = '"properties":';
	const start = header.indexOf(marker, features);
	if (features < 0 || start < 0) {
		const source = JSON.parse(
			readFileSync(path, "utf8"),
		) as FeatureCollection;
		const properties = source.features?.[0]?.properties;
		if (typeof properties !== "object" || properties === null) {
			throw new Error(
				`${path}: could not find the first GeoJSON feature properties`,
			);
		}
		return properties as Record<string, unknown>;
	}
	const objectStart = start + marker.length;
	let depth = 0;
	let quoted = false;
	let escaped = false;
	for (let index = objectStart; index < header.length; index += 1) {
		const character = header[index];
		if (quoted) {
			if (escaped) escaped = false;
			else if (character === "\\") escaped = true;
			else if (character === '"') quoted = false;
			continue;
		}
		if (character === '"') {
			quoted = true;
			continue;
		}
		if (character === "{") depth += 1;
		if (character === "}") {
			depth -= 1;
			if (depth === 0) {
				return JSON.parse(
					header.slice(objectStart, index + 1),
				) as Record<string, unknown>;
			}
		}
	}
	const source = JSON.parse(readFileSync(path, "utf8")) as FeatureCollection;
	const properties = source.features?.[0]?.properties;
	if (typeof properties !== "object" || properties === null) {
		throw new Error(
			`${path}: first GeoJSON feature properties exceed the scan window`,
		);
	}
	return properties as Record<string, unknown>;
};

const firstProperties = (path: string) => {
	if (path.toLowerCase().endsWith(".dbf")) return readDbfRecords(path)[0];
	return firstGeoJsonProperties(path);
};

const targetGeographies = (
	artifacts: AreaReleaseArtifact[],
	pair: { codeProperty: string; nameProperty: string },
) =>
	[
		...new Set(
			artifacts
				.filter(
					(artifact) =>
						propertyFamily(artifact.codeProperty, "code") ===
							propertyFamily(pair.codeProperty, "code") &&
						propertyFamily(artifact.nameProperty, "name") ===
							propertyFamily(pair.nameProperty, "name"),
				)
				.map((artifact) => artifact.geography),
		),
	].sort();

const candidateId = (from: CandidateSide, to: CandidateTarget) =>
	`${toKebabCase(from.geography)}-${from.boundaryRelease}-to-${toKebabCase(
		to.geography ?? propertyFamily(to.codeProperty, "code"),
	)}-${"boundaryRelease" in to ? to.boundaryRelease : "unavailable"}`;

export const compileRelationshipCandidates = (
	repositoryRoot: string,
	artifacts: AreaReleaseArtifact[],
	publishedRelationships: PublishedRelationship[] = [],
): RelationshipCandidateInventory => {
	const candidates: RelationshipCandidate[] = [];
	for (const artifact of artifacts) {
		const source = sourceFor(repositoryRoot, artifact);
		if (!source) continue;
		const initialProperties = firstProperties(source.path);
		if (!initialProperties) continue;
		const from: CandidateSide = {
			geography: artifact.geography,
			boundaryRelease: artifact.boundaryRelease,
			codeProperty: artifact.codeProperty,
			nameProperty: artifact.nameProperty,
		};
		const candidatePairs = propertyPairs(initialProperties).filter(
			(pair) =>
				pair.codeProperty !== from.codeProperty ||
				pair.nameProperty !== from.nameProperty,
		);
		if (candidatePairs.length === 0) continue;
		const propertiesByFeature = readProperties(source.path);
		for (const pair of candidatePairs) {
			const matches = artifacts.filter(
				(candidate) =>
					candidate.codeProperty === pair.codeProperty &&
					candidate.nameProperty === pair.nameProperty,
			);
			const geographies = targetGeographies(artifacts, pair);
			const to: CandidateTarget =
				matches.length === 1
					? {
							geography: matches[0].geography,
							boundaryRelease: matches[0].boundaryRelease,
							...pair,
						}
					: {
							...(geographies.length === 1
								? { geography: geographies[0] }
								: {}),
							...pair,
						};
			const relationships = new Map<string, Set<string>>();
			let missingValueFeatureCount = 0;
			for (const properties of propertiesByFeature) {
				const sourceCode = stringValue(properties[from.codeProperty]);
				const targetCode = stringValue(properties[pair.codeProperty]);
				if (!sourceCode || !targetCode) {
					missingValueFeatureCount += 1;
					continue;
				}
				const targets =
					relationships.get(sourceCode) ?? new Set<string>();
				targets.add(targetCode);
				relationships.set(sourceCode, targets);
			}
			const targetCodes = new Set(
				[...relationships.values()].flatMap((targets) => [...targets]),
			);
			const multiTargetSourceCount = [...relationships.values()].filter(
				(targets) => targets.size > 1,
			).length;
			const target = matches.length === 1 ? matches[0] : undefined;
			const reasons: string[] = [];
			if (matches.length === 0) {
				reasons.push(
					`No compiled target release has ${pair.codeProperty}/${pair.nameProperty} fields.`,
				);
			} else if (matches.length > 1) {
				reasons.push(
					`${matches.length} compiled target releases share ${pair.codeProperty}/${pair.nameProperty} fields.`,
				);
			}
			if (missingValueFeatureCount > 0) {
				reasons.push(
					`${missingValueFeatureCount} source features have no usable source or target code.`,
				);
			}
			if (multiTargetSourceCount > 0) {
				reasons.push(
					`${multiTargetSourceCount} source codes map to more than one target code.`,
				);
			}
			const targetAreas = target
				? new Map(target.areas.map((area) => [area.code, area]))
				: undefined;
			const unresolvedTargetCodes = targetAreas
				? [...targetCodes].filter((code) => !targetAreas.has(code))
				: [];
			if (unresolvedTargetCodes.length > 0) {
				reasons.push(
					`${unresolvedTargetCodes.length} target codes are absent from the compiled target release.`,
				);
			}
			const status = !target
				? "not-available"
				: reasons.length === 0
					? "eligible"
					: "needs-review";
			const candidate: RelationshipCandidate = {
				id: candidateId(from, to),
				input: source.input,
				from,
				to,
				status,
				validation: {
					endpoints: {
						from: {
							status: "verified",
							availableAreaCount: artifact.areas.length,
							referencedCodeCount: relationships.size,
						},
						to: target
							? {
									status: "verified",
									availableAreaCount: target.areas.length,
									referencedCodeCount: targetCodes.size,
								}
							: {
									status: "not-available",
									reason: reasons[0],
								},
					},
					relationship: {
						sourceFeatureCount: propertiesByFeature.length,
						sourceCodeCount: relationships.size,
						targetCodeCount: targetCodes.size,
						multiTargetSourceCount,
						missingValueFeatureCount,
					},
					reasons,
				},
			};
			const published = publishedRelationships.find(
				(relationship) =>
					relationship.from.geography === from.geography &&
					relationship.from.boundaryRelease ===
						from.boundaryRelease &&
					"boundaryRelease" in to &&
					relationship.to.geography === to.geography &&
					relationship.to.boundaryRelease === to.boundaryRelease,
			);
			if (published) candidate.publishedCrosswalkId = published.id;
			candidates.push(candidate);
		}
	}
	candidates.sort((left, right) => left.id.localeCompare(right.id));
	const content = JSON.stringify({ schemaVersion: 1, candidates });
	return { schemaVersion: 1, contentHash: sha256(content), candidates };
};
