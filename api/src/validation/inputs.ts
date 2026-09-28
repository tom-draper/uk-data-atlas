import { readFileSync } from "node:fs";
import type { AreaInventory, AreaReleaseArtifact } from "../areaInventory";
import type { BoundaryRegistry } from "../boundaryRegistry";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "../crosswalkInventory";
import type {
	CategoricalObservation,
	DataCatalog,
	MeasureSource,
	PopulationObservation,
} from "../dataCatalog";
import type { ExportManifest } from "../exportManifest";
import type { GeographyInventory } from "../geographyInventory";
import type { GeometrySourceRegistry } from "../geometrySourceRegistry";
import type { RelationshipCandidateInventory } from "../relationshipCandidates";
import { VALIDATION_CHECKS, type ValidationCheckId } from "../validationReport";
import { sha256 } from "./findings";

export type ValidationWaiver = {
	check: ValidationCheckId;
	reason: string;
	resources: string[];
};

/**
 * A measure whose value in every area is the sum of other measures in the same
 * source partitions, such as households counted by how many cars they have.
 */
export type MeasureTotal = {
	measureId: string;
	components: string[];
};

/**
 * An observation artifact as published. The ward population artifact predates
 * the per-period shape and carries one period at the top level.
 */
export type ObservationArtifact = {
	schemaVersion: 1;
	contentHash: string;
	measureId: string;
	sourceGeography: MeasureSource["sourceGeography"];
} & (
	| {
			periods: Array<{
				period: string;
				records: Array<PopulationObservation | CategoricalObservation>;
			}>;
	  }
	| { period: string; records: PopulationObservation[] }
);

export type ValidationInputs = {
	boundaryRegistry: BoundaryRegistry;
	areaInventory: AreaInventory;
	areaArtifacts: AreaReleaseArtifact[];
	geometrySources: GeometrySourceRegistry;
	crosswalkInventory: CrosswalkInventory;
	crosswalkArtifacts: CrosswalkArtifact[];
	relationshipCandidates: RelationshipCandidateInventory;
	geographyInventory: GeographyInventory;
	dataCatalog: DataCatalog;
	exportManifest: ExportManifest;
	/** Observation artifacts keyed by the id of the export that serves them. */
	observationArtifacts: Record<string, ObservationArtifact>;
	measureTotals: MeasureTotal[];
	measureTotalsHash: string;
	waivers: ValidationWaiver[];
	waiversHash: string;
};

export const readValidationWaivers = (path: string) => {
	const content = readFileSync(path, "utf8");
	const file = JSON.parse(content) as {
		schemaVersion?: unknown;
		waivers?: unknown;
	};
	if (file.schemaVersion !== 1 || !Array.isArray(file.waivers)) {
		throw new Error(`Invalid validation waivers at ${path}`);
	}
	const waivers = file.waivers.map((waiver: unknown) => {
		const { check, reason, resources } = (waiver ?? {}) as Record<
			string,
			unknown
		>;
		if (
			!VALIDATION_CHECKS.includes(check as ValidationCheckId) ||
			typeof reason !== "string" ||
			reason.trim().length === 0 ||
			!Array.isArray(resources) ||
			resources.length === 0 ||
			!resources.every((resource) => typeof resource === "string")
		) {
			throw new Error(`Invalid validation waiver at ${path}`);
		}
		return { check, reason, resources } as ValidationWaiver;
	});
	return { waivers, waiversHash: sha256(content) };
};

export const readMeasureTotals = (path: string) => {
	const content = readFileSync(path, "utf8");
	const file = JSON.parse(content) as {
		schemaVersion?: unknown;
		totals?: unknown;
	};
	if (file.schemaVersion !== 1 || !Array.isArray(file.totals)) {
		throw new Error(`Invalid measure totals at ${path}`);
	}
	const isId = (value: unknown) =>
		typeof value === "string" && value.trim().length > 0;
	const measureTotals = file.totals.map((total: unknown) => {
		const { measureId, components } = (total ?? {}) as Record<
			string,
			unknown
		>;
		if (
			!isId(measureId) ||
			!Array.isArray(components) ||
			components.length < 2 ||
			!components.every(isId)
		) {
			throw new Error(`Invalid measure total at ${path}`);
		}
		return { measureId, components } as MeasureTotal;
	});
	return { measureTotals, measureTotalsHash: sha256(content) };
};
