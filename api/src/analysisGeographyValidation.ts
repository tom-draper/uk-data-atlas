import { createHash } from "node:crypto";
import {
	isNumericObservation,
	observationArtifactName,
	type AnyMeasureObservationArtifact,
	type DataCatalog,
} from "./dataCatalog";
import {
	convertObservations,
	convertThroughSteps,
	type ConversionResult,
} from "./conversion";
import { buildTranslationSteps } from "./resolver/translation";
import type { CrosswalkArtifact } from "./crosswalkInventory";
import type {
	AnalysisGeographyInventory,
	AnalysisGeographySupport,
} from "./analysisGeographies";

export type AnalysisGeographyValidationInventory = {
	schemaVersion: 1;
	contentHash: string;
	analysisGeographyInventoryHash: string;
	dataCatalogHash: string;
	crosswalkInventoryHash: string;
	supports: Array<{
		measureId: string;
		analysisGeography: AnalysisGeographySupport["analysisGeography"];
		source: AnalysisGeographySupport["source"];
		/** The reviewed crosswalk, for a one-crosswalk support. */
		crosswalk?: { id: string; contentHash: string };
		/** Every crosswalk of the reviewed path, for a path-backed support. */
		path?: {
			id: string;
			crosswalks: Array<{
				id: string;
				contentHash: string;
				direction: "forward" | "reverse";
			}>;
		};
		observations: { artifact: string; contentHash: string };
		periods: Array<{
			period: string;
			method: "exact";
			inputRecordCount: number;
			outputRecordCount: number;
			inputTotal: number;
			outputTotal: number;
		}>;
	}>;
};

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const totalOf = (records: Array<{ value: number }>) =>
	records.reduce((total, record) => total + record.value, 0);

/**
 * A configured pair becomes public only after the exact converter can cover
 * and conserve every observation in every source period. This is deliberately
 * stricter than checking a crosswalk's metadata: a later source refresh must
 * not introduce an unmapped code or a non-numeric value unnoticed.
 */
export const validateAnalysisGeographies = (
	analysisGeographies: AnalysisGeographyInventory,
	dataCatalog: DataCatalog,
	crosswalkLookup: Map<string, CrosswalkArtifact>,
	observationsByArtifact: Map<string, AnyMeasureObservationArtifact>,
): AnalysisGeographyValidationInventory => {
	const supports = analysisGeographies.supports.map((support) => {
		const measure = dataCatalog.measures.find(
			(candidate) => candidate.id === support.measureId,
		);
		const source = measure?.sources.find(
			(candidate) =>
				candidate.datasetId === support.source.datasetId &&
				candidate.sourceGeography.type === support.source.geography &&
				candidate.sourceGeography.boundaryYear ===
					support.source.boundaryYear,
		);
		if (!measure || !source)
			throw new Error(`${support.measureId}: reviewed source is not published.`);
		const artifactName = observationArtifactName(measure.id, source);
		const observations = observationsByArtifact.get(artifactName);
		if (!observations)
			throw new Error(
				`${support.measureId}: observation artifact ${artifactName} is not built.`,
			);
		// A path is carried through every step in its declared direction; a
		// single crosswalk forward, exactly as the series route applies it.
		const routeSteps = (
			support.path
				? support.path.steps.map(({ crosswalk, direction }) => ({
						id: crosswalk.id,
						direction,
					}))
				: [{ id: support.crosswalk!.id, direction: "forward" as const }]
		).map(({ id, direction }) => {
			const artifact = crosswalkLookup.get(id);
			if (!artifact) throw new Error(`${id}: reviewed crosswalk is not built.`);
			return { artifact, direction };
		});
		// Indexed once per support, since every period converts through them.
		const indexedSteps = routeSteps.map(({ artifact, direction }) => ({
			artifact,
			direction,
			steps: buildTranslationSteps(artifact, direction),
		}));
		const convert = (
			records: Parameters<typeof convertObservations>[1],
		): ConversionResult =>
			support.path
				? convertThroughSteps(indexedSteps, records)
				: convertObservations(routeSteps[0]!.artifact, records);
		const periods = support.source.periods.map((period) => {
			const sourcePeriod = observations.periods.find(
				(candidate) => candidate.period === period,
			);
			if (!sourcePeriod)
				throw new Error(
					`${support.measureId}/${period}: source period is not in ${artifactName}.`,
				);
			if (!sourcePeriod.records.every(isNumericObservation))
				throw new Error(
					`${support.measureId}/${period}: reviewed conversion has non-numeric observations.`,
				);
			const converted = convert(sourcePeriod.records);
			if (converted.status !== "converted")
				throw new Error(
					`${support.measureId}/${period}: reviewed conversion failed: ${converted.reason}`,
				);
			if (converted.method !== "exact")
				throw new Error(
					`${support.measureId}/${period}: reviewed conversion must be exact; got ${converted.method}.`,
				);
			const inputTotal = totalOf(sourcePeriod.records);
			const outputTotal = totalOf(converted.records);
			if (inputTotal !== outputTotal)
				throw new Error(
					`${support.measureId}/${period}: exact conversion did not conserve ${inputTotal} (${outputTotal}).`,
				);
			return {
				period,
				method: "exact" as const,
				inputRecordCount: sourcePeriod.records.length,
				outputRecordCount: converted.records.length,
				inputTotal,
				outputTotal,
			};
		});
		return {
			measureId: support.measureId,
			analysisGeography: support.analysisGeography,
			source: support.source,
			...(support.path
				? {
						path: {
							id: support.path.id,
							crosswalks: routeSteps.map(({ artifact, direction }) => ({
								id: artifact.id,
								contentHash: artifact.contentHash,
								direction,
							})),
						},
					}
				: {
						crosswalk: {
							id: routeSteps[0]!.artifact.id,
							contentHash: routeSteps[0]!.artifact.contentHash,
						},
					}),
			observations: {
				artifact: artifactName,
				contentHash: observations.contentHash,
			},
			periods,
		};
	});
	const withoutHash = {
		schemaVersion: 1 as const,
		analysisGeographyInventoryHash: analysisGeographies.contentHash,
		dataCatalogHash: dataCatalog.contentHash,
		crosswalkInventoryHash: analysisGeographies.crosswalkInventoryHash,
		supports,
	};
	return { ...withoutHash, contentHash: sha256(JSON.stringify(withoutHash)) };
};
