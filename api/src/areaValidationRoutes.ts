import { areaNotFound } from "./areaResources";
import { MAX_BATCH_VALUES } from "./batchValidation";
import { exportMatchReport, matchManifest } from "./matchReport";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/** Validate many area codes or names against one published boundary release. */
export const handleAreaValidationRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		segments[1] !== "areas:validate"
	)
		return undefined;
	const geographyResolver = context.geographyResolver;
	const geography = parsedUrl.searchParams.get("geography");
	const boundaryRelease = parsedUrl.searchParams.get("release");
	const values = parsedUrl.searchParams.getAll("value");
	const parents = parsedUrl.searchParams.getAll("parent");
	const format = parsedUrl.searchParams.get("format") ?? "json";
	if (format !== "json" && format !== "csv")
		return problem(400, "Invalid Query", "format must be json or csv.");
	if (Boolean(geography) !== Boolean(boundaryRelease))
		return problem(
			400,
			"Invalid Query",
			"geography and release must be supplied together, or both omitted to infer a likely compiled release.",
		);
	if (values.length === 0)
		return problem(
			400,
			"Invalid Query",
			"Supply at least one value to validate, as value=; it may be repeated.",
		);
	if (values.length > MAX_BATCH_VALUES)
		return problem(
			400,
			"Invalid Query",
			`At most ${MAX_BATCH_VALUES} values can be validated in one request; this one has ${values.length}.`,
		);
	if (parents.length > 0 && parents.length !== values.length)
		return problem(
			400,
			"Invalid Query",
			"parent, when supplied, must occur once for every value in the same input order.",
		);
	if (!geography || !boundaryRelease) {
		const unavailable = geographyResolver.requires("areas");
		if (unavailable) return unavailable;
		const matched = geographyResolver.matchAreaValues(
			values,
			parents.length > 0 ? parents : undefined,
		);
		const manifest = matchManifest(
			releaseId,
			values,
			parents.length > 0 ? parents : undefined,
			matched,
		);
		const body = {
			...matched,
			manifest,
			note: "likely is the compiled geography/release with the most exact resolutions. It is not an automatic join or conversion: mixed-code-systems and incomplete input remain unjoinable, and recommendations are published paths only. A parent resolves a shared name only when one published containment relationship matches it.",
		};
		if (format === "csv") {
			const report = exportMatchReport(manifest, matched.values);
			return {
				status: 200,
				body: envelope(releaseId, body),
				representation: {
					contentType: "text/csv; charset=utf-8",
					body: report,
					headers: {
						"content-disposition":
							'attachment; filename="area-match-report.csv"',
					},
				},
			};
		}
		return {
			status: 200,
			body: envelope(releaseId, body),
		};
	}
	const validated = geographyResolver.validateAreas(
		geography,
		boundaryRelease,
		values,
		parents.length > 0 ? parents : undefined,
	);
	if (!validated) return areaNotFound(context, geography, boundaryRelease);
	const matched = {
		likely: {
			geography,
			boundaryRelease,
			resolved: validated.values.filter(
				(value) =>
					value.status === "valid" || value.status === "matched",
			).length,
		},
		candidates: [],
		values: validated.values,
		verdict: validated.summary.joinable ? "joinable" : "incomplete",
		recommendations: [],
	};
	const manifest = matchManifest(
		releaseId,
		values,
		parents.length > 0 ? parents : undefined,
		matched,
	);
	const body = {
		geography,
		boundaryRelease,
		summary: validated.summary,
		values: validated.values,
		manifest,
		note: 'Codes are checked against this exact release; one it does not hold says whether other releases or geographies do. Names match only exactly, through a published alias, or with an administrative title such as "City of" set aside, and a name meaning several areas lists them all rather than choosing. Anything trimmed or re-cased to read a value is listed in normalised. joinable is true only when every value names exactly one area of this release.',
	};
	if (format === "csv") {
		return {
			status: 200,
			body: envelope(releaseId, body),
			representation: {
				contentType: "text/csv; charset=utf-8",
				body: exportMatchReport(manifest, validated.values),
				headers: {
					"content-disposition":
						'attachment; filename="area-match-report.csv"',
				},
			},
		};
	}
	return {
		status: 200,
		body: envelope(releaseId, body),
	};
};
