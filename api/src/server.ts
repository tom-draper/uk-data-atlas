import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	createAreaLookup,
	type AreaInventory,
	type AreaLookup,
	type AreaReleaseArtifact,
} from "./areaInventory";
import type { AtlasRelease } from "./atlasRelease";
import { readArchivedAtlasReleases } from "./atlasReleaseHistory";
import { AreaGeometryCache, type GeometrySourceLookup } from "./areaGeometry";
import { readGeometrySourceLookup } from "./geometrySources";
import {
	createAreaRelationshipIndex,
	type AreaRelationshipIndex,
} from "./areaRelationships";
import type { BoundaryRegistry } from "./boundaryRegistry";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "./crosswalkInventory";
import type { GeographyInventory } from "./geographyInventory";
import type { RelationshipCandidateInventory } from "./relationshipCandidates";
import {
	createNamedLocationLookup,
	type NamedLocationInventory,
	type NamedLocationLookup,
} from "./namedLocations";
import type { ValidationReport } from "./validationReport";
import {
	type DataCatalog,
	isLegacyPopulationSource,
	type AnyMeasureObservationArtifact,
	observationArtifactName,
	type PopulationLocalAuthorityObservationArtifact,
	type PopulationObservationArtifact,
} from "./dataCatalog";
import type { MeasureCompatibilityInventory } from "./measureCompatibility";
import type { ExportManifest } from "./exportManifest";
import { httpResponse } from "./httpResponse";
import type { LookupManifest } from "./lookupExports";
import { createAreaSearchIndex } from "./areaSearchRoutes";
import { route } from "./routes";
import type { CrosswalkLookup, RouteContext } from "./routing";

const registryPath = (apiRoot: string) =>
	join(apiRoot, "public", "boundary-releases.json");

export const readBoundaryRegistry = (apiRoot: string): BoundaryRegistry => {
	const registry = JSON.parse(
		readFileSync(registryPath(apiRoot), "utf8"),
	) as BoundaryRegistry;
	if (registry.schemaVersion !== 1 || !Array.isArray(registry.releases)) {
		throw new Error(
			`Invalid boundary registry at ${registryPath(apiRoot)}`,
		);
	}
	return registry;
};

export const readGeographyInventory = (apiRoot: string): GeographyInventory => {
	const path = join(apiRoot, "public", "geography-inventory.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
	) as GeographyInventory;
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.releases)) {
		throw new Error(`Invalid geography inventory at ${path}`);
	}
	return inventory;
};

export const readAreaInventory = (apiRoot: string): AreaInventory => {
	const inventoryPath = join(apiRoot, "public", "area-inventory.json");
	const inventory = JSON.parse(
		readFileSync(inventoryPath, "utf8"),
	) as AreaInventory;
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.releases)) {
		throw new Error(`Invalid area inventory at ${inventoryPath}`);
	}
	return inventory;
};

export const readAreaLookup = (
	apiRoot: string,
	inventory = readAreaInventory(apiRoot),
): AreaLookup => {
	const artifacts = inventory.releases.flatMap((release) => {
		if (release.status !== "available") return [];
		const path = join(apiRoot, "public", release.artifact);
		const artifact = JSON.parse(
			readFileSync(path, "utf8"),
		) as AreaReleaseArtifact;
		if (
			artifact.schemaVersion !== 1 ||
			artifact.contentHash !== release.contentHash ||
			!Array.isArray(artifact.areas)
		) {
			throw new Error(`Invalid area release artifact at ${path}`);
		}
		return [artifact];
	});
	return createAreaLookup(artifacts);
};

export const readCrosswalkInventory = (apiRoot: string): CrosswalkInventory => {
	const path = join(apiRoot, "public", "crosswalk-inventory.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
	) as CrosswalkInventory;
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.crosswalks)) {
		throw new Error(`Invalid crosswalk inventory at ${path}`);
	}
	return inventory;
};

export const readCrosswalkLookup = (
	apiRoot: string,
	inventory: CrosswalkInventory,
): CrosswalkLookup =>
	new Map(
		inventory.crosswalks.map((crosswalk) => {
			const path = join(apiRoot, "public", crosswalk.artifact);
			const artifact = JSON.parse(
				readFileSync(path, "utf8"),
			) as CrosswalkArtifact;
			if (
				artifact.schemaVersion !== 1 ||
				artifact.contentHash !== crosswalk.contentHash ||
				!Array.isArray(artifact.records)
			) {
				throw new Error(`Invalid crosswalk artifact at ${path}`);
			}
			return [crosswalk.id, artifact];
		}),
	);

export const readAtlasRelease = (apiRoot: string): AtlasRelease => {
	const path = join(apiRoot, "public", "atlas-release.json");
	const release = JSON.parse(readFileSync(path, "utf8")) as AtlasRelease;
	if (release.schemaVersion !== 1 || !Array.isArray(release.artifacts)) {
		throw new Error(`Invalid atlas release manifest at ${path}`);
	}
	return release;
};

export const readRelationshipCandidateInventory = (
	apiRoot: string,
): RelationshipCandidateInventory => {
	const path = join(apiRoot, "public", "relationship-candidates.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
	) as RelationshipCandidateInventory;
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.candidates)) {
		throw new Error(`Invalid relationship candidate inventory at ${path}`);
	}
	return inventory;
};

export const readNamedLocationInventory = (
	apiRoot: string,
): NamedLocationInventory => {
	const path = join(apiRoot, "public", "named-locations.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
	) as NamedLocationInventory;
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.locations)) {
		throw new Error(`Invalid named location inventory at ${path}`);
	}
	return inventory;
};

export const readValidationReport = (apiRoot: string): ValidationReport => {
	const path = join(apiRoot, "public", "validation-report.json");
	const report = JSON.parse(readFileSync(path, "utf8")) as ValidationReport;
	if (report.schemaVersion !== 1 || !Array.isArray(report.resources)) {
		throw new Error(`Invalid validation report at ${path}`);
	}
	return report;
};

export const readDataCatalog = (apiRoot: string): DataCatalog => {
	const path = join(apiRoot, "public", "data-catalog.json");
	const catalog = JSON.parse(readFileSync(path, "utf8")) as DataCatalog;
	if (
		catalog.schemaVersion !== 1 ||
		!Array.isArray(catalog.datasets) ||
		!Array.isArray(catalog.measures)
	) {
		throw new Error(`Invalid data catalogue at ${path}`);
	}
	return catalog;
};

export const readExportManifest = (apiRoot: string): ExportManifest => {
	const path = join(apiRoot, "public", "export-manifest.json");
	const manifest = JSON.parse(readFileSync(path, "utf8")) as ExportManifest;
	if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.exports)) {
		throw new Error(`Invalid export manifest at ${path}`);
	}
	return manifest;
};

export const readLookupManifest = (apiRoot: string): LookupManifest => {
	const path = join(apiRoot, "public", "lookup-manifest.json");
	const manifest = JSON.parse(readFileSync(path, "utf8")) as LookupManifest;
	if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.lookups)) {
		throw new Error(`Invalid lookup manifest at ${path}`);
	}
	return manifest;
};

export const readPopulationObservations = (
	apiRoot: string,
): PopulationObservationArtifact => {
	const path = join(apiRoot, "public", "population-observations.json");
	const observations = JSON.parse(
		readFileSync(path, "utf8"),
	) as PopulationObservationArtifact;
	if (
		observations.schemaVersion !== 1 ||
		observations.measureId !== "population-estimate" ||
		observations.period !== "2022" ||
		!Array.isArray(observations.records)
	) {
		throw new Error(`Invalid population observations at ${path}`);
	}
	return observations;
};

export const readPopulationLocalAuthorityObservations = (
	apiRoot: string,
): PopulationLocalAuthorityObservationArtifact => {
	const path = join(
		apiRoot,
		"public",
		"population-local-authority-observations.json",
	);
	const observations = JSON.parse(
		readFileSync(path, "utf8"),
	) as PopulationLocalAuthorityObservationArtifact;
	if (
		observations.schemaVersion !== 1 ||
		observations.measureId !== "population-estimate" ||
		observations.sourceGeography.type !== "localAuthority" ||
		!Array.isArray(observations.periods)
	) {
		throw new Error(
			`Invalid local-authority population observations at ${path}`,
		);
	}
	return observations;
};

/**
 * Every measure's observations except the two population artifacts, which
 * predate the convention. Driven by the catalogue rather than a hardcoded
 * list, so publishing a measure needs no change here.
 */
export const readMeasureObservations = (
	apiRoot: string,
	dataCatalog: DataCatalog,
): AnyMeasureObservationArtifact[] =>
	dataCatalog.measures.flatMap((measure) =>
		measure.sources
			.filter((source) => !isLegacyPopulationSource(measure.id, source))
			.map((source) => {
				const path = join(
					apiRoot,
					"public",
					`${observationArtifactName(measure.id, source)}.json`,
				);
				const observations = JSON.parse(
					readFileSync(path, "utf8"),
				) as AnyMeasureObservationArtifact;
				if (
					observations.schemaVersion !== 1 ||
					observations.measureId !== measure.id ||
					observations.sourceGeography.type !==
						source.sourceGeography.type ||
					observations.sourceGeography.boundaryYear !==
						source.sourceGeography.boundaryYear ||
					!Array.isArray(observations.periods)
				) {
					throw new Error(`Invalid measure observations at ${path}`);
				}
				return observations;
			}),
	);

export const readMeasureCompatibility = (
	apiRoot: string,
): MeasureCompatibilityInventory => {
	const path = join(apiRoot, "public", "measure-compatibility.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
	) as MeasureCompatibilityInventory;
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.measures)) {
		throw new Error(`Invalid measure compatibility inventory at ${path}`);
	}
	return inventory;
};

export type ApiCatalogues = Required<RouteContext>;

export const readApiCatalogues = (apiRoot: string): ApiCatalogues => {
	const areaInventory = readAreaInventory(apiRoot);
	const areaLookup = readAreaLookup(apiRoot, areaInventory);
	const namedLocationInventory = readNamedLocationInventory(apiRoot);
	const crosswalkInventory = readCrosswalkInventory(apiRoot);
	const dataCatalog = readDataCatalog(apiRoot);
	const atlasRelease = readAtlasRelease(apiRoot);
	const exportManifest = readExportManifest(apiRoot);
	if (exportManifest.dataCatalogHash !== dataCatalog.contentHash) {
		throw new Error(
			"Export manifest was not built from the current data catalogue.",
		);
	}
	const geometrySources = readGeometrySourceLookup(apiRoot);
	const crosswalkLookup = readCrosswalkLookup(apiRoot, crosswalkInventory);
	return {
		boundaryRegistry: readBoundaryRegistry(apiRoot),
		geographyInventory: readGeographyInventory(apiRoot),
		areaInventory,
		areaLookup,
		areaSearchIndex: createAreaSearchIndex(areaLookup),
		areaRelationshipIndex: createAreaRelationshipIndex(
			crosswalkLookup.values(),
		),
		areaGeometryCache: new AreaGeometryCache(
			resolve(apiRoot, ".."),
			geometrySources,
		),
		crosswalkInventory,
		crosswalkLookup,
		atlasRelease,
		atlasReleaseHistory: new Map(
			[
				...readArchivedAtlasReleases(join(apiRoot, "public")),
				atlasRelease,
			].map((release) => [release.releaseId, release]),
		),
		relationshipCandidateInventory:
			readRelationshipCandidateInventory(apiRoot),
		validationReport: readValidationReport(apiRoot),
		namedLocationInventory,
		namedLocationLookup: createNamedLocationLookup(namedLocationInventory),
		dataCatalog,
		exportManifest,
		lookupManifest: readLookupManifest(apiRoot),
		populationObservations: readPopulationObservations(apiRoot),
		populationLocalAuthorityObservations:
			readPopulationLocalAuthorityObservations(apiRoot),
		measureObservations: readMeasureObservations(apiRoot, dataCatalog),
		measureCompatibilityInventory: readMeasureCompatibility(apiRoot),
	};
};

export const createApiServer = (catalogues: ApiCatalogues) =>
	createServer((request, response) => {
		const { status, headers, body } = httpResponse(request, (method) =>
			route(method, request.url, catalogues),
		);
		response.writeHead(status, headers);
		response.end(body);
	});
