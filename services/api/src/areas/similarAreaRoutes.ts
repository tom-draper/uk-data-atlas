import {
	isNumericObservation,
	observationsFor,
} from "@uk-data-atlas/catalogue/node";
import {
	envelope,
	invalidQuery,
	choices,
	readChoice,
	problem,
	readWholeNumber,
	type ApiResponse,
	type RouteRequestFor,
} from "../runtime/index.ts";
import { refused } from "../observationResolution/observationPlan";
import { publishedPartitions } from "../dataDefaults";
import { QUERY_RULES } from "../queryRules";
import { selectSourcePartition } from "../sourcePartition";
import { similarAreas } from "../similarAreas";

const MAX_MEASURES = 10;
const SIMILAR = QUERY_RULES["GET /areas/{geography}/{code}/similar"];

const selectedMeasureIds = (value: string | null) =>
	value
		?.split(",")
		.map((id) => id.trim())
		.filter(Boolean) ?? [];

/** Source-exact similarity across up to ten numeric measure partitions. */
export const handleSimilarAreaRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequestFor<never>): ApiResponse | undefined => {
	if (
		segments.length !== 5 ||
		segments[0] !== "v1" ||
		segments[1] !== "areas" ||
		segments[4] !== "similar"
	)
		return undefined;
	const [geography, code] = segments.slice(2, 4);
	if (!geography || !code)
		return problem(
			400,
			"Invalid Path",
			"A similar-area request needs a geography and area code.",
		);
	const { dataCatalog, measureObservations } = context;
	if (!dataCatalog)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the data catalogue before finding similar areas.",
		);
	const measureIds = selectedMeasureIds(
		parsedUrl.searchParams.get("measures"),
	);
	if (measureIds.length === 0)
		return invalidQuery(
			"measures must name one to ten comma-separated measure ids.",
		);
	if (measureIds.length > MAX_MEASURES)
		return invalidQuery(
			`measures may name at most ${MAX_MEASURES} measures.`,
		);
	if (new Set(measureIds).size !== measureIds.length)
		return invalidQuery(
			"measures must not name the same measure more than once.",
		);
	const period = parsedUrl.searchParams.get("period")?.trim();
	if (!period)
		return invalidQuery(
			"period is required and must be served by every selected measure.",
		);
	const method = readChoice(
		parsedUrl.searchParams.get("method"),
		SIMILAR.method,
	);
	if (!method)
		return invalidQuery(`method must be ${choices(SIMILAR.method)}.`);
	const limit = readWholeNumber(
		parsedUrl.searchParams.get("limit"),
		SIMILAR.limit,
	);
	if (limit === null)
		return invalidQuery(
			`limit must be a whole number from ${SIMILAR.limit.minimum} to ${SIMILAR.limit.maximum}.`,
		);
	const measures = measureIds.map((id) =>
		dataCatalog.measures.find((measure) => measure.id === id),
	);
	const missingMeasureIndex = measures.findIndex((measure) => !measure);
	if (missingMeasureIndex !== -1)
		return problem(
			404,
			"Not Found",
			`No published measure serves ${measureIds[missingMeasureIndex]}.`,
		);
	if (measures.some((measure) => measure!.valueKind === "categorical"))
		return problem(
			422,
			"Operation Not Supported",
			"Categorical measures cannot be used to find similar areas.",
		);
	const selected = measures.map((measure) =>
		selectSourcePartition({
			context,
			measure: measure!,
			query: { geography, period },
			periods: [period],
		}),
	);
	const refusedSelection = selected.find(
		(selection) => selection.kind === "refusal",
	);
	if (refusedSelection?.kind === "refusal")
		return refused(refusedSelection.resolution.refusal);
	const incompleteIndex = selected.findIndex(
		(selection) =>
			selection.kind === "incomplete" ||
			(selection.kind === "selected" && selection.period === null),
	);
	if (incompleteIndex !== -1) {
		const measure = measures[incompleteIndex]!;
		return invalidQuery(
			`${measure.id} does not serve geography=${geography} and period=${period}. Published partitions: ${publishedPartitions(measure)}.`,
		);
	}
	const partitions = selected.map((selection) => {
		if (selection.kind !== "selected" || selection.period === null)
			throw new Error("Selected similar-area partition is incomplete.");
		return selection;
	});
	if (new Set(partitions.map(({ boundaryYear }) => boundaryYear)).size > 1)
		return problem(
			422,
			"Operation Not Supported",
			"The selected measures use different boundary years and cannot be compared without converting geographies.",
		);
	const observations = partitions.map((partition, index) =>
		observationsFor(measures[index]!.id, partition.plan.source, period, {
			measureObservations,
		}),
	);
	const missingObservationsIndex = observations.findIndex((value) => !value);
	if (missingObservationsIndex !== -1)
		return problem(
			503,
			"Catalogue Unavailable",
			`The observation artifact for ${measures[missingObservationsIndex]!.id} is missing, or does not contain the catalogue's declared source period.`,
		);
	if (
		!observations.every((value) =>
			value!.records.every(isNumericObservation),
		)
	)
		return problem(
			503,
			"Catalogue Unavailable",
			"A selected observation artifact does not contain numeric records required for similarity.",
		);
	const inputs = observations.map((observation, index) => ({
		id: measures[index]!.id,
		values: observation!.records.flatMap((record) =>
			isNumericObservation(record)
				? [{ areaCode: record.areaCode, value: record.value }]
				: [],
		),
	}));
	const targetValueCount = inputs.filter(({ values }) =>
		values.some(({ areaCode }) => areaCode === code),
	).length;
	if (targetValueCount === 0)
		return problem(
			404,
			"Not Found",
			`No selected measure is published for ${geography} area ${code}.`,
		);
	if (targetValueCount !== inputs.length)
		return problem(
			422,
			"Operation Not Supported",
			`The target area ${code} is missing a selected measure and cannot be compared.`,
		);
	const result = similarAreas({
		targetAreaCode: code,
		measures: inputs,
		method,
		limit,
	});
	return {
		status: 200,
		body: envelope(releaseId, {
			target: { geography, code },
			method,
			measures: result.scaling.map((scaling, index) => ({
				id: scaling.measureId,
				period,
				sourceGeography: {
					type: partitions[index]!.plan.source.sourceGeography.type,
					boundaryYear:
						partitions[index]!.plan.source.sourceGeography
							.boundaryYear,
				},
				mean: scaling.mean,
				standardDeviation: scaling.standardDeviation,
			})),
			droppedAreaCount: result.droppedAreaCount,
			areas: result.areas,
		}),
	};
};
