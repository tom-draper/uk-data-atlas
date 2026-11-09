import {
	areaIdentityTable,
	crosswalkTable,
	type LookupFormat,
	lookupBodyHash,
	namedLocationMembersTable,
	renderLookup,
} from "@uk-data-atlas/areas";
import { findMeasureObservations } from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	envelope,
	invalidQuery,
	problem,
	type ApiResponse,
} from "@uk-data-atlas/atlas-runtime/api";
import type { RouteRequestFor } from "@uk-data-atlas/atlas-runtime/api";
import {
	observationTableOf,
	observationTextOf,
} from "@uk-data-atlas/atlas-runtime/measures";
import { choices, readChoice } from "@uk-data-atlas/atlas-runtime/api";
import { QUERY_RULES } from "./queryRules";

const EXPORT = QUERY_RULES["GET /exports/{export-id}"];

const LOOKUP = QUERY_RULES["GET /lookups/{lookup-id}"];

/** A prebuilt download containing every published partition of one measure. */
export const handleMeasureExport = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: Pick<
	RouteRequestFor<never>,
	"context" | "releaseId" | "parsedUrl" | "segments"
>): ApiResponse => {
	if (!context.dataCatalog || !context.exportManifest)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the data catalogue and export manifest before downloading a measure.",
		);
	const measure = context.dataCatalog.measures.find(
		(item) => item.id === segments[2],
	);
	if (!measure)
		return problem(404, "Not Found", "No measure matches that identity.");
	const formats = parsedUrl.searchParams.getAll("format");
	const hashes = parsedUrl.searchParams.getAll("hash");
	if (
		formats.length > 1 ||
		hashes.length > 1 ||
		(formats[0] !== undefined && !["csv", "parquet"].includes(formats[0]))
	)
		return invalidQuery(
			"format must be csv or parquet, and each parameter may appear only once.",
		);
	const format = formats[0] ?? "parquet";
	const entry = context.exportManifest.measureExports?.find(
		(item) => item.measureId === measure.id,
	);
	const download = entry?.formats.find((item) => item.format === format);
	if (!download)
		return problem(
			503,
			"Export Unavailable",
			"The complete measure export has not been built.",
		);
	const hash = download.contentHash.replace(/^sha256:/, "");
	if (hashes[0] !== undefined && hashes[0] !== hash)
		return problem(
			404,
			"Not Found",
			"No measure export matches that content hash.",
		);
	const file = context.exportFiles?.get(download.artifact);
	if (
		!file ||
		file.contentHash !== download.contentHash ||
		file.bytes !== download.bytes ||
		file.gzipBytes !== download.gzipBytes
	)
		return problem(
			503,
			"Export Unavailable",
			"The requested measure export is missing or does not match its manifest.",
		);
	return {
		status: 200,
		body: envelope(releaseId, entry),
		representation: {
			contentType:
				format === "csv"
					? "text/csv; charset=utf-8"
					: "application/vnd.apache.parquet",
			body: file,
			headers: {
				"content-disposition": `attachment; filename="${measure.id}.${format}"`,
				...(hashes.length
					? { "cache-control": "public, max-age=31536000, immutable" }
					: {}),
			},
		},
	};
};

/** Immutable observation exports and rendered lookup artifacts. */
export const handleBulkRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequestFor<
	| "areaIdentityReleaseForArtifact"
	| "releaseAreas"
	| "crosswalkSummaryForArtifact"
	| "crosswalk"
	| "namedLocationMembershipInventory"
>): ApiResponse | undefined => {
	const { dataCatalog, exportManifest, lookupManifest, measureObservations } =
		context;
	if (
		segments.length === 4 &&
		segments[0] === "v1" &&
		segments[1] === "data" &&
		segments[3] === "export"
	)
		return handleMeasureExport({ context, releaseId, parsedUrl, segments });
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
		const format = readChoice(
			parsedUrl.searchParams.get("format"),
			EXPORT.format,
		);
		if (!format)
			return invalidQuery(`format must be ${choices(EXPORT.format)}.`);
		if (format !== "json") {
			const download = listedExport.formats?.find(
				(item) => item.format === format,
			);
			const file =
				download && context.exportFiles?.get(download.artifact);
			if (
				!file ||
				!download ||
				file.contentHash !== download.contentHash ||
				file.bytes !== download.bytes ||
				file.gzipBytes !== download.gzipBytes
			)
				return problem(
					503,
					"Export Unavailable",
					"Build the requested bulk export before downloading it.",
				);
			return {
				status: 200,
				body: envelope(releaseId, listedExport),
				representation: {
					contentType:
						format === "csv"
							? "text/csv; charset=utf-8"
							: "application/vnd.apache.parquet",
					body: file,
					headers: {
						"content-disposition": `attachment; filename="${listedExport.id}.${format}"`,
					},
				},
			};
		}
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
				? findMeasureObservations(
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
		const storedText = observationTextOf(artifact);
		if (
			storedText !== undefined &&
			Buffer.byteLength(storedText) !== listedExport.bytes
		)
			return problem(
				503,
				"Export Unavailable",
				"The stored observation bytes do not match the export manifest.",
			);
		return {
			status: 200,
			body: envelope(releaseId, listedExport),
			representation: {
				contentType: "application/json",
				// A table-backed export is the whole table, the artifact read.
				body:
					storedText ??
					`${JSON.stringify(observationTableOf(artifact) ?? artifact)}\n`,
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
		const format = readChoice(
			parsedUrl.searchParams.get("format"),
			LOOKUP.format,
		);
		if (!format)
			return invalidQuery(`format must be ${choices(LOOKUP.format)}.`, {
				code: "invalid_format",
			});
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
