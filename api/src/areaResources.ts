import type { AreaLookup } from "./areaInventory";
import type { DataCatalog } from "./dataCatalog";
import type { measureCoverage } from "./measureCoverage";
import { observationsFor } from "./observationArtifacts";
import { problem, type ApiResponse } from "./routeResponse";
import type { RouteContext } from "./routing";

export const findArea = (
	areaLookup: AreaLookup | undefined,
	geography: string,
	boundaryRelease: string,
	code: string,
) => areaLookup?.get(`${geography}/${boundaryRelease}`)?.get(code);

/**
 * A 404 for an area identity that says why it resolves to nothing: an
 * unpublished geography or release, identities not compiled, or a code the
 * release does not hold, with the releases that do.
 */
export const areaNotFound = (
	context: RouteContext,
	geography?: string,
	boundaryRelease?: string,
	code?: string,
): ApiResponse => {
	const resolved = context.geographyResolver.explainAreaAbsence(
		geography ?? "",
		boundaryRelease ?? "",
		code ?? "",
	);
	const { detail, ...absence } = resolved ?? {
		detail: "No compiled boundary registry is available to explain this area identity.",
	};
	return problem(404, "Not Found", detail, absence);
};

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
					const record = observations?.records.find(
						(candidate) => candidate.areaCode === code,
					);
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
