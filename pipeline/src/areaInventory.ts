import { existsSync, readFileSync } from "node:fs";
import { readGeoJsonProperties } from "../../shared/geoJsonProperties";
import { sourceGeoJsonPath } from "./boundarySourcePaths";
import { join } from "node:path";
import type {
	AreaAdapterManifest,
	AreaPropertyAdapter,
} from "../../shared/areaAdapters";
import type {
	AreaSourceAdapter,
	AreaSourceAdapterManifest,
} from "../../shared/areaSourceAdapters";
import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import { releaseKey } from "@uk-data-atlas/geography";
import { readDbfRecords } from "@uk-data-atlas/shapefile";
import { sha256 } from "../../shared/contentHash";

type FeatureCollection = {
	type?: unknown;
	features?: Array<{ properties?: unknown }>;
};

type BoundaryMetadata = {
	files?: unknown;
};

import type {
	UnavailableAreaRelease,
	AreaRecord,
	AreaReleaseArtifact,
	AreaInventory,
} from "../../shared/areaInventory";
export type {
	AreaRecord,
	AreaReleaseArtifact,
	AreaInventory,
} from "../../shared/areaInventory";

export type CompiledAreas = {
	inventory: AreaInventory;
	artifacts: AreaReleaseArtifact[];
};

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

const sourceDbfPath = (directory: string) => {
	const metadata = JSON.parse(
		readFileSync(join(directory, "meta.json"), "utf8"),
	) as BoundaryMetadata;
	if (!Array.isArray(metadata.files)) return undefined;
	const shapefile = metadata.files.find(
		(candidate) =>
			typeof candidate === "object" &&
			candidate !== null &&
			(candidate as { role?: unknown }).role === "source" &&
			typeof (candidate as { path?: unknown }).path === "string" &&
			(candidate as { path: string }).path.toLowerCase().endsWith(".shp"),
	) as { path: string } | undefined;
	return shapefile
		? join(directory, shapefile.path.replace(/\.shp$/i, ".dbf"))
		: undefined;
};

const compileProperties = (
	path: string,
	propertiesByFeature: Array<Record<string, unknown>>,
	geography: string,
	boundaryRelease: string,
	adapter?: AreaPropertyAdapter,
	sourceAdapter?: AreaSourceAdapter,
): AreaReleaseArtifact | UnavailableAreaRelease => {
	const firstProperties = propertiesByFeature[0];
	if (!firstProperties) {
		return {
			id: boundaryRelease,
			geography,
			status: "not-compiled",
			reason: "The declared source has no feature properties.",
		};
	}
	const fields = adapter ?? findProperties(firstProperties);
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
	for (const [index, properties] of propertiesByFeature.entries()) {
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

const compileGeoJson = (
	path: string,
	geography: string,
	boundaryRelease: string,
	adapter?: AreaPropertyAdapter,
	sourceAdapter?: AreaSourceAdapter,
): AreaReleaseArtifact | UnavailableAreaRelease => {
	// Only the property table is compiled, so the geometry is never built.
	const source = readGeoJsonProperties(path);
	if (source.type !== "FeatureCollection") {
		return {
			id: boundaryRelease,
			geography,
			status: "not-compiled",
			reason: "The declared GeoJSON source is not a FeatureCollection.",
		};
	}
	const features = sourceAdapter
		? source.properties.filter((properties) => {
				const value = (
					properties as Record<string, unknown> | undefined
				)?.[sourceAdapter.filter.property];
				return (
					typeof value === "string" &&
					value.startsWith(sourceAdapter.filter.startsWith)
				);
			})
		: source.properties;
	if (features.length === 0) {
		return {
			id: boundaryRelease,
			geography,
			status: "not-compiled",
			reason: "The configured source selection did not match any features.",
		};
	}
	const propertiesByFeature = features.map((properties, index) => {
		if (typeof properties !== "object" || properties === null) {
			throw new Error(`${path}: feature ${index} has no properties`);
		}
		return properties as Record<string, unknown>;
	});
	return compileProperties(
		path,
		propertiesByFeature,
		geography,
		boundaryRelease,
		adapter,
		sourceAdapter,
	);
};

export const compileAreas = (
	repositoryRoot: string,
	boundaryRegistry: BoundaryRegistry,
	adapters: AreaAdapterManifest = {},
	sourceAdapters: AreaSourceAdapterManifest = {},
): CompiledAreas => {
	const artifacts: AreaReleaseArtifact[] = [];
	const releases = boundaryRegistry.releases.map((release) => {
		const identity = releaseKey(release.geography, release.id);
		const sourceAdapter = sourceAdapters[identity];
		const directory = join(
			repositoryRoot,
			"data/source",
			"boundaries",
			toKebabCase(sourceAdapter?.source.geography ?? release.geography),
			sourceAdapter?.source.boundaryRelease ?? release.id,
		);
		const geoJsonPath = sourceGeoJsonPath(directory);
		const dbfPath = sourceDbfPath(directory);
		if (
			(!geoJsonPath || !existsSync(geoJsonPath)) &&
			(!dbfPath || !existsSync(dbfPath))
		) {
			return {
				id: release.id,
				geography: release.geography,
				status: "not-compiled" as const,
				reason: "No declared GeoJSON or Shapefile attribute source is available for this release.",
			};
		}
		const result =
			geoJsonPath && existsSync(geoJsonPath)
				? compileGeoJson(
						geoJsonPath,
						release.geography,
						release.id,
						adapters[identity],
						sourceAdapter,
					)
				: compileProperties(
						dbfPath as string,
						readDbfRecords(dbfPath as string),
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
