import {
	areaIdentityTable,
	crosswalkTable,
	type LookupFormat,
	lookupBodyHash,
	namedLocationMembersTable,
	renderLookup,
} from "./lookupExports";
import {
	findMeasureObservations,
	isLegacyPopulationSource,
} from "./dataCatalog";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";
import { observationTableOf } from "./observationTables";

/** Immutable observation exports and rendered lookup artifacts. */
export const handleBulkRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	const {
		dataCatalog,
		exportManifest,
		lookupManifest,
		measureObservations,
		populationLocalAuthorityObservations,
		populationObservations,
	} = context;
	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "exports"
	) {
		return exportManifest
			? {
					status: 200,
					body: envelope(releaseId, {
						...exportManifest,
						note: "Each export is the immutable publisher-observation JSON artifact used by the API. Reviewed served corrections, if any, are recorded separately and retain the publisher code on the affected record.",
					}),
				}
			: problem(
					503,
					"Catalogue Unavailable",
					"Build the export manifest before listing bulk exports.",
				);
	}
	if (
		segments.length === 3 &&
		segments[0] === "v1" &&
		segments[1] === "exports"
	) {
		if (!exportManifest || !dataCatalog)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the data catalogue and export manifest before downloading bulk exports.",
			);
		const listedExport = exportManifest.exports.find(
			(candidate) => candidate.id === segments[2],
		);
		if (!listedExport)
			return problem(
				404,
				"Not Found",
				"No bulk export matches that identity.",
			);
		const measure = dataCatalog.measures.find(
			(candidate) => candidate.id === listedExport.measureId,
		);
		// Not a partition to answer a query, but the one that produced this
		// export: the match is on the dataset and the exact period set the
		// manifest recorded, so it stays here rather than going through the
		// resolver, which chooses a partition from what a caller asked for.
		const source = measure?.sources.find(
			(candidate) =>
				candidate.datasetId === listedExport.datasetId &&
				candidate.sourceGeography.type ===
					listedExport.sourceGeography.type &&
				candidate.sourceGeography.boundaryYear ===
					listedExport.sourceGeography.boundaryYear &&
				candidate.periods.length === listedExport.periods.length &&
				candidate.periods.every(
					(period, index) => period === listedExport.periods[index],
				),
		);
		const artifact =
			measure && source
				? isLegacyPopulationSource(measure.id, source)
					? source.sourceGeography.type === "ward"
						? populationObservations
						: populationLocalAuthorityObservations
					: findMeasureObservations(
							measureObservations ?? [],
							measure.id,
							source,
						)
				: undefined;
		if (!artifact || artifact.contentHash !== listedExport.contentHash)
			return problem(
				503,
				"Export Unavailable",
				"The catalogued export artifact is unavailable or does not match its manifest hash.",
			);
		return {
			status: 200,
			body: envelope(releaseId, listedExport),
			representation: {
				contentType: "application/json",
				// A table-backed export is the whole table, the artifact read.
				body: `${JSON.stringify(observationTableOf(artifact) ?? artifact)}\n`,
				headers: {
					"content-disposition": `attachment; filename=\"${listedExport.artifact}.json\"`,
				},
			},
		};
	}
	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "lookups"
	) {
		return lookupManifest
			? {
					status: 200,
					body: envelope(releaseId, {
						...lookupManifest,
						note: "Each lookup is rendered from the published artifact its source names, and its bytes match the hash listed for the format.",
					}),
				}
			: problem(
					503,
					"Catalogue Unavailable",
					"Build the lookup manifest before listing bulk lookups.",
				);
	}
	if (
		segments.length === 3 &&
		segments[0] === "v1" &&
		segments[1] === "lookups"
	) {
		if (!lookupManifest)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the lookup manifest before downloading bulk lookups.",
			);
		const entry = lookupManifest.lookups.find(
			(candidate) => candidate.id === segments[2],
		);
		if (!entry)
			return problem(
				404,
				"Not Found",
				"No bulk lookup matches that identity.",
			);
		const format = parsedUrl.searchParams.get("format") ?? "csv";
		if (format !== "csv" && format !== "ndjson")
			return problem(
				400,
				"Invalid Query",
				"format must be csv or ndjson.",
				{ code: "invalid_format" },
			);
		const table = (() => {
			if (entry.kind === "area-identities") {
				const release =
					context.geographyResolver.areaIdentityReleaseForArtifact(
						entry.source.artifact,
					);
				const areas =
					release &&
					context.geographyResolver.releaseAreas(
						release.geography,
						release.id,
					);
				return release && areas && release.status === "available"
					? areaIdentityTable({
							geography: release.geography,
							boundaryRelease: release.id,
							artifact: release.artifact,
							contentHash: release.contentHash,
							areas: areas.values(),
						})
					: undefined;
			}
			if (entry.kind === "crosswalk") {
				const summary =
					context.geographyResolver.crosswalkSummaryForArtifact(
						entry.source.artifact,
					);
				const crosswalk =
					summary && context.geographyResolver.crosswalk(summary.id);
				return crosswalk && summary
					? crosswalkTable(crosswalk, summary.artifact)
					: undefined;
			}
			const namedLocationInventory =
				context.geographyResolver.namedLocationMembershipInventory();
			return namedLocationInventory
				? namedLocationMembersTable(
						namedLocationInventory,
						entry.source.artifact,
					)
				: undefined;
		})();
		const rendered = table && renderLookup(table, format as LookupFormat);
		const listed = entry.formats[format as LookupFormat];
		if (!rendered || lookupBodyHash(rendered.body) !== listed.contentHash)
			return problem(
				503,
				"Lookup Unavailable",
				"The lookup's source artifact is unavailable or no longer renders the bytes its manifest lists.",
			);
		return {
			status: 200,
			body: envelope(releaseId, entry),
			representation: {
				contentType: rendered.contentType,
				body: rendered.body,
				headers: {
					"content-disposition": `attachment; filename=\"${entry.id}.${format === "csv" ? "csv" : "ndjson"}\"`,
				},
			},
		};
	}
	return undefined;
};
