import type { AreaLookup } from "@uk-data-atlas/areas";
import type { DataCatalog } from "../catalogue/dataCatalog";
import type { measureCoverage } from "../catalogue/measureCoverage";
import { observationsFor } from "../catalogue/observationArtifacts";
import { releaseKey } from "@uk-data-atlas/geography";

export const findArea = (
	areaLookup: AreaLookup | undefined,
	geography: string,
	boundaryRelease: string,
	code: string,
) => areaLookup?.get(releaseKey(geography, boundaryRelease))?.get(code);

/**
 * The source partitions of a measure assessed against one boundary release,
 * each period saying whether its artifact holds a value for the area. Only a
 * partition whose code set was assessed against this exact release is listed;
 * the assessment compares codes and does not assert equal geometry.
 */
export const areaMeasureSources = (
	measure: DataCatalog["measures"][number],
	coverage: ReturnType<typeof measureCoverage>,
	geography: string,
	boundaryRelease: string,
	code: string,
	artifacts: Parameters<typeof observationsFor>[3],
) =>
	coverage?.sources.flatMap((coveredSource, index) => {
		// Release ids repeat across geographies, as 2024-12-uk-bgc does for
		// wards and local authorities, so the geography must match as well.
		const boundaryCoverage =
			coveredSource.sourceGeography.type === geography
				? coveredSource.boundaryCoverage.find(
						(candidate) =>
							candidate.boundaryRelease === boundaryRelease,
					)
				: undefined;
		const source = measure.sources[index];
		if (!boundaryCoverage || !source) return [];
		return [
			{
				dataset: coveredSource.dataset,
				sourceGeography: coveredSource.sourceGeography,
				codeSetCompatibility: boundaryCoverage,
				periods: source.periods.map((period) => {
					const observations = observationsFor(
						measure.id,
						source,
						period,
						artifacts,
					);
					const record = observations?.recordFor(code);
					return observations
						? {
								period,
								artifact: observations.artifact,
								contentHash: observations.contentHash,
								availability: record
									? ("present" as const)
									: ("absent" as const),
								...(record
									? { status: record.status ?? "unknown" }
									: {}),
							}
						: { period, availability: "not-published" as const };
				}),
			},
		];
	}) ?? [];
