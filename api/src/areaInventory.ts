import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AreaAdapterManifest, AreaPropertyAdapter } from "./areaAdapters";
import type {
	AreaSourceAdapter,
	AreaSourceAdapterManifest,
} from "./areaSourceAdapters";
import type { BoundaryRegistry } from "./boundaryRegistry";

type FeatureCollection = {
	type?: unknown;
	features?: Array<{ properties?: unknown }>;
};

type BoundaryMetadata = {
	files?: unknown;
};

export type AreaRecord = {
	code: string;
	name: string;
	aliases?: string[];
};

export type AreaReleaseArtifact = {
	schemaVersion: 1;
	contentHash: string;
	geography: string;
	boundaryRelease: string;
	codeProperty: string;
	nameProperty: string;
	derivedFrom?: AreaSourceAdapter;
	areas: AreaRecord[];
};

type AvailableAreaRelease = {
	id: string;
	geography: string;
	status: "available";
	recordCount: number;
	artifact: string;
	contentHash: string;
	codeProperty: string;
	nameProperty: string;
	derivedFrom?: AreaSourceAdapter;
};

type UnavailableAreaRelease = {
	id: string;
	geography: string;
	status: "not-compiled";
	reason: string;
};

export type AreaInventory = {
	schemaVersion: 1;
	contentHash: string;
	boundaryRegistryHash: string;
	releases: Array<AvailableAreaRelease | UnavailableAreaRelease>;
};

export type CompiledAreas = {
	inventory: AreaInventory;
	artifacts: AreaReleaseArtifact[];
};

export type AreaLookup = Map<string, Map<string, AreaRecord>>;

export const createAreaLookup = (
	artifacts: AreaReleaseArtifact[],
): AreaLookup =>
	new Map(
		artifacts.map((artifact) => [
			`${artifact.geography}/${artifact.boundaryRelease}`,
			new Map(artifact.areas.map((area) => [area.code, area])),
		]),
	);

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const toKebabCase = (value: string) =>
	value.replaceAll(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

const stringValue = (value: unknown): string | undefined =>
	typeof value === "string" && value.trim().length > 0
		? value.trim()
		: undefined;

const propertyStem = (key: string, suffix: "code" | "name") => {
	const pattern = suffix === "code" ? /(?:cd|code)$/i : /(?:nm|name)$/i;
	return key.replace(pattern, "").toLowerCase();
};

const findProperties = (properties: Record<string, unknown>) => {
	const keys = Object.keys(properties);
	const codeKeys = keys.filter((key) => /(?:cd|code)$/i.test(key));
	const nameKeys = keys.filter((key) => /(?:nm|name)$/i.test(key));
	const pairs = codeKeys.flatMap((codeProperty) => {
		const stem = propertyStem(codeProperty, "code");
		return nameKeys
			.filter(
				(nameProperty) => propertyStem(nameProperty, "name") === stem,
			)
			.map((nameProperty) => ({ codeProperty, nameProperty }));
	});
	return pairs.length === 1 ? pairs[0] : undefined;
};

const sourceGeoJsonPath = (directory: string) => {
	const metadata = JSON.parse(
		readFileSync(join(directory, "meta.json"), "utf8"),
	) as BoundaryMetadata;
	if (!Array.isArray(metadata.files)) return undefined;
	const file = metadata.files.find(
		(candidate) =>
			typeof candidate === "object" &&
			candidate !== null &&
			(candidate as { role?: unknown }).role === "source" &&
			typeof (candidate as { path?: unknown }).path === "string" &&
			(candidate as { path: string }).path
				.toLowerCase()
				.endsWith(".geojson"),
	) as { path: string } | undefined;
	return file ? join(directory, file.path) : undefined;
};

const compileGeoJson = (
	path: string,
	geography: string,
	boundaryRelease: string,
	adapter?: AreaPropertyAdapter,
	sourceAdapter?: AreaSourceAdapter,
): AreaReleaseArtifact | UnavailableAreaRelease => {
	const source = JSON.parse(readFileSync(path, "utf8")) as FeatureCollection;
	if (
		source.type !== "FeatureCollection" ||
		!Array.isArray(source.features)
	) {
		return {
			id: boundaryRelease,
			geography,
			status: "not-compiled",
			reason: "The declared GeoJSON source is not a FeatureCollection.",
		};
	}
	const features = sourceAdapter
		? source.features.filter((feature) => {
				const properties = feature.properties as
					Record<string, unknown> | undefined;
				const value = properties?.[sourceAdapter.filter.property];
				return (
					typeof value === "string" &&
					value.startsWith(sourceAdapter.filter.startsWith)
				);
			})
		: source.features;
	if (features.length === 0) {
		return {
			id: boundaryRelease,
			geography,
			status: "not-compiled",
			reason: "The configured source selection did not match any features.",
		};
	}
	const firstProperties = features[0]?.properties;
	if (typeof firstProperties !== "object" || firstProperties === null) {
		return {
			id: boundaryRelease,
			geography,
			status: "not-compiled",
			reason: "The declared GeoJSON source has no feature properties.",
		};
	}
	const fields =
		adapter ?? findProperties(firstProperties as Record<string, unknown>);
	if (!fields) {
		return {
			id: boundaryRelease,
			geography,
			status: "not-compiled",
			reason: "Could not identify exactly one matching code/name property pair.",
		};
	}
	if (
		!(fields.codeProperty in firstProperties) ||
		!(fields.nameProperty in firstProperties)
	) {
		throw new Error(
			`${path}: configured code/name properties do not exist on the first feature`,
		);
	}
	const areasByCode = new Map<string, AreaRecord>();
	for (const [index, feature] of features.entries()) {
		if (
			typeof feature.properties !== "object" ||
			feature.properties === null
		) {
			throw new Error(`${path}: feature ${index} has no properties`);
		}
		const properties = feature.properties as Record<string, unknown>;
		const code = stringValue(properties[fields.codeProperty]);
		const name = stringValue(properties[fields.nameProperty]);
		if (!code || !name) {
			throw new Error(
				`${path}: feature ${index} has no usable code or name`,
			);
		}
		const welshName = stringValue(properties[`${fields.nameProperty}W`]);
		const existing = areasByCode.get(code);
		if (existing) {
			if (existing.name !== name) {
				throw new Error(
					`${path}: area code ${code} has conflicting names`,
				);
			}
			if (
				welshName &&
				welshName !== name &&
				!existing.aliases?.includes(welshName)
			) {
				existing.aliases = [
					...(existing.aliases ?? []),
					welshName,
				].sort();
			}
			continue;
		}
		areasByCode.set(code, {
			code,
			name,
			...(welshName && welshName !== name
				? { aliases: [welshName] }
				: {}),
		});
	}
	const areas = [...areasByCode.values()];
	const content = JSON.stringify({
		schemaVersion: 1,
		geography,
		boundaryRelease,
		codeProperty: fields.codeProperty,
		nameProperty: fields.nameProperty,
		...(sourceAdapter === undefined ? {} : { derivedFrom: sourceAdapter }),
		areas,
	});
	return {
		schemaVersion: 1,
		contentHash: sha256(content),
		geography,
		boundaryRelease,
		codeProperty: fields.codeProperty,
		nameProperty: fields.nameProperty,
		...(sourceAdapter === undefined ? {} : { derivedFrom: sourceAdapter }),
		areas,
	};
};

export const compileAreas = (
	repositoryRoot: string,
	boundaryRegistry: BoundaryRegistry,
	adapters: AreaAdapterManifest = {},
	sourceAdapters: AreaSourceAdapterManifest = {},
): CompiledAreas => {
	const artifacts: AreaReleaseArtifact[] = [];
	const releases = boundaryRegistry.releases.map((release) => {
		const identity = `${release.geography}/${release.id}`;
		const sourceAdapter = sourceAdapters[identity];
		const directory = join(
			repositoryRoot,
			"data",
			"boundaries",
			toKebabCase(sourceAdapter?.source.geography ?? release.geography),
			sourceAdapter?.source.boundaryRelease ?? release.id,
		);
		const sourcePath = sourceGeoJsonPath(directory);
		if (!sourcePath || !existsSync(sourcePath)) {
			return {
				id: release.id,
				geography: release.geography,
				status: "not-compiled" as const,
				reason: "No declared GeoJSON source is available for this release.",
			};
		}
		const result = compileGeoJson(
			sourcePath,
			release.geography,
			release.id,
			adapters[identity],
			sourceAdapter,
		);
		if ("areas" in result) {
			artifacts.push(result);
			return {
				id: release.id,
				geography: release.geography,
				status: "available" as const,
				recordCount: result.areas.length,
				artifact: `areas/${release.geography}/${release.id}.json`,
				contentHash: result.contentHash,
				codeProperty: result.codeProperty,
				nameProperty: result.nameProperty,
				...(result.derivedFrom === undefined
					? {}
					: { derivedFrom: result.derivedFrom }),
			};
		}
		return result;
	});
	const content = JSON.stringify({
		schemaVersion: 1,
		boundaryRegistryHash: boundaryRegistry.contentHash,
		releases,
	});
	return {
		inventory: {
			schemaVersion: 1,
			contentHash: sha256(content),
			boundaryRegistryHash: boundaryRegistry.contentHash,
			releases,
		},
		artifacts,
	};
};
