import { requireGeography } from "@uk-data-atlas/atlas-runtime/api";
import { sha256 } from "@uk-data-atlas/artifacts";
import { directRelationshipPath } from "@uk-data-atlas/atlas-runtime/relationships";
import { relationshipPurposeFor } from "@uk-data-atlas/atlas-runtime/relationships";
import { readChoice } from "@uk-data-atlas/atlas-runtime/api";
import { QUERY_RULES } from "../queryRules";
import { readPostedRows } from "../requestRows";
import {
	envelope,
	invalidQuery,
	problem,
	type ApiResponse,
} from "@uk-data-atlas/atlas-runtime/api";
import type {
	RouteContext,
	RouteRequestFor,
} from "@uk-data-atlas/atlas-runtime/api";
import {
	convertSuppliedCounts,
	readSuppliedCounts,
} from "../suppliedConversion";

const RULES = QUERY_RULES["POST /crosswalks/{crosswalk-id}:convert"];

export const crosswalkConversionId = (segments: string[]) =>
	segments.length === 3 &&
	segments[0] === "v1" &&
	segments[1] === "crosswalks" &&
	segments[2]?.endsWith(":convert")
		? segments[2].slice(0, -":convert".length)
		: undefined;

export const handleCrosswalkConversionRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
	method,
	body,
}: RouteRequestFor<
	"missingRequirement" | "areaCodes" | "crosswalk" | "indexedPathSteps"
> & { context: Required<Pick<RouteContext, "areaValidation">> }):
	ApiResponse | undefined => {
	const id = crosswalkConversionId(segments);
	if (id === undefined) return undefined;
	if (method !== "POST")
		return problem(
			405,
			"Method Not Allowed",
			"Send counts as a POST body with code and value columns, as JSON or CSV.",
		);
	if (!readChoice(parsedUrl.searchParams.get("semantics"), RULES.semantics))
		return invalidQuery(
			"semantics=count is required: the supplied values must be non-negative counts that add over areas.",
		);
	const weighting = readChoice(
		parsedUrl.searchParams.get("weighting"),
		RULES.weighting,
	);
	if (weighting === null)
		return invalidQuery(
			"weighting must be area or population, or omitted for an exact regrouping.",
		);
	const resolver = context.geographyResolver;
	const unavailable = requireGeography(resolver, "crosswalks");
	if (unavailable) return unavailable;
	const artifact = resolver.crosswalk(id);
	if (!artifact)
		return problem(
			404,
			"Not Found",
			"No published crosswalk matches that id.",
		);
	const purpose = relationshipPurposeFor(artifact);
	if (!purpose || artifact.method === "best-fit")
		return problem(
			422,
			"Operation Not Supported",
			"This crosswalk does not support value conversion. Best-fit assignments do not establish whole-area containment.",
			{
				code: "conversion_not_available",
				absence: "crosswalk-not-for-conversion",
			},
		);
	if (
		weighting !== undefined &&
		(!("basis" in artifact.weighting) ||
			artifact.weighting.basis !== weighting)
	)
		return invalidQuery(
			"The requested weighting does not match this crosswalk's published weighting basis.",
		);
	const rows = readPostedRows(body, { withValues: true });
	if ("status" in rows) return rows;
	const validation = context.areaValidation.validateAreas(
		artifact.from.geography,
		artifact.from.boundaryRelease,
		rows.areas,
		rows.parents,
	);
	if (!validation)
		return problem(
			503,
			"Catalogue Unavailable",
			"The crosswalk's exact source release must have compiled area identities before supplied rows can be validated.",
		);
	const counts = readSuppliedCounts(rows, validation.values);
	if (counts.kind === "rejected")
		return problem(
			422,
			"Rows Rejected",
			"Every row must name one source area and carry a finite non-negative count. No conversion was applied. The first 1,000 rejected rows are listed.",
			{
				code: "conversion_not_available",
				absence: "invalid-rows",
				rejectedCount: counts.rejectedCount,
				rejected: counts.rejected,
			},
		);
	const indexed = resolver.indexedPathSteps(
		directRelationshipPath(artifact, "forward", purpose),
	);
	if ("missingCrosswalkId" in indexed || !indexed.steps[0])
		return problem(
			503,
			"Catalogue Unavailable",
			"The crosswalk's conversion steps are not loaded.",
		);
	const step = indexed.steps[0];
	const inputTotal = counts.records.reduce(
		(total, record) => total + record.value,
		0,
	);
	if (!Number.isFinite(inputTotal))
		return problem(
			422,
			"Rows Rejected",
			"The input total exceeds the supported numeric range. No conversion was applied.",
			{ code: "conversion_not_available", absence: "non-finite-total" },
		);
	const converted = convertSuppliedCounts(step, counts.records);
	if (converted.status === "refused")
		return problem(422, "Operation Not Supported", converted.reason, {
			code: "conversion_not_available",
			absence: converted.absence,
			areaCount: converted.areaCount,
			areaSample: converted.areaSample,
		});
	if (converted.method !== "exact" && weighting === undefined)
		return problem(
			422,
			"Weighting Required",
			"This conversion splits counts. Opt in with weighting=area or weighting=population to use this crosswalk's published weights. No conversion was applied.",
			{
				code: "conversion_not_available",
				absence: "weighting-not-requested",
			},
		);
	const outputTotal = converted.records.reduce(
		(total, record) => total + record.value,
		0,
	);
	if (
		!Number.isFinite(outputTotal) ||
		converted.records.some((record) => !Number.isFinite(record.value))
	)
		return problem(
			422,
			"Operation Not Supported",
			"The converted total exceeds the supported numeric range.",
			{ code: "conversion_not_available", absence: "non-finite-total" },
		);
	const sourceAreas = resolver.areaCodes(
		artifact.from.geography,
		artifact.from.boundaryRelease,
	)?.length;
	return {
		status: 200,
		body: envelope(releaseId, {
			from: artifact.from,
			to: artifact.to,
			semantics: "count",
			input: {
				contentHash: sha256(body?.text ?? ""),
				rowCount: rows.areas.length,
				normalisedCount: validation.values.filter(
					(entry) => entry.normalised?.length,
				).length,
			},
			crosswalk: {
				id: artifact.id,
				href: `/v1/crosswalks/${artifact.id}`,
				contentHash: artifact.contentHash,
				method: artifact.method,
				quality: artifact.quality,
				weighting: artifact.weighting,
			},
			method: converted.method,
			coverage: { ...converted.coverage, sourceAreas },
			inputTotal,
			outputTotal,
			records: converted.records,
			note: "Only supplied source areas contribute. Complete means every source this crosswalk maps to that target was supplied, not that the crosswalk covers the whole geography. Unreached targets are absent, never zero. Weighted values are estimates and are not rounded.",
		}),
	};
};
