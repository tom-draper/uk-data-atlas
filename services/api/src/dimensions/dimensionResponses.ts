import type { ApiResponse } from "../runtime/index.ts";
import {
	describeMembers,
	type DimensionalMeasure,
	type Series,
} from "@uk-data-atlas/measures";
import type { DimensionReading } from "./dimensionRequests";

/**
 * Responses to a request read through dimension filters. The route answered
 * for a selected series and the response says what the API chose.
 */

type Body = Record<string, unknown>;

const isObject = (value: unknown): value is Body =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** The members a series was read with, marking those the API chose. */
const membersRead = (series: Series, reading: DimensionReading) => {
	const members = describeMembers(reading.measure, series.dimensions);
	for (const dimension of Object.keys(reading.defaulted))
		if (members[dimension])
			members[dimension] = { ...members[dimension]!, defaulted: true };
	return members;
};

const defaultNote = (reading: DimensionReading) =>
	Object.entries(reading.defaulted)
		.map(([dimension, code]) => {
			const held = reading.measure.dimensions.find(
				(candidate) => candidate.id === dimension,
			);
			const member = held?.members.find(
				(candidate) => candidate.code === code,
			);
			const total = held?.total === code;
			return `No ${dimension} was given, so ${total ? "its total, " : ""}${member?.label ?? code} (${dimension}=${code}), was used.`;
		})
		.join(" ");

const resolvedFrom = (series: Series, reading: DimensionReading) =>
	reading.resolvedFrom
		? {
				id: reading.resolvedFrom.id,
				measure: reading.measure.id,
				dimensions: series.dimensions,
				...(series.datasetId ? { datasetId: series.datasetId } : {}),
			}
		: undefined;

/** The headers a response read through the dimension layer carries. */
const readingHeaders = (reading: DimensionReading) => ({
	...(reading.canonicalUrl
		? { "content-location": reading.canonicalUrl }
		: {}),
});

/** Add what was read to a route's data, where its data is an object. */
const withReading = (
	data: unknown,
	series: Series,
	reading: DimensionReading,
) => {
	if (!isObject(data)) return data;
	const defaulted = Object.keys(reading.defaulted).length > 0;
	const from = resolvedFrom(series, reading);
	return {
		...data,
		dimensions: membersRead(series, reading),
		...(defaulted
			? {
					defaults: {
						...(isObject(data.defaults) ? data.defaults : {}),
						...reading.defaulted,
					},
				}
			: {}),
		...(defaulted && typeof data.note === "string"
			? { note: `${data.note} ${defaultNote(reading)}` }
			: defaulted
				? { note: defaultNote(reading) }
				: {}),
		...(from ? { resolvedFrom: from } : {}),
	};
};

/** Add the selected members to a route's answer for one series. */
export const seriesResponse = (
	response: ApiResponse,
	series: Series,
	reading: DimensionReading,
): ApiResponse => {
	const headers = { ...response.headers, ...readingHeaders(reading) };
	if (!("data" in response.body)) {
		const from = resolvedFrom(series, reading);
		return {
			...response,
			headers,
			body: {
				...response.body,
				...(from ? { resolvedFrom: from } : {}),
			} as typeof response.body,
		};
	}
	if (response.representation) return { ...response, headers };
	return {
		...response,
		headers,
		body: {
			...response.body,
			data: withReading(response.body.data, series, reading),
		},
	};
};

/**
 * Several series answered together, one entry each. The response succeeds
 * when any entry does; an entry that fails carries its problem.
 */
export const breakdownResponse = (
	answers: Array<{ series: Series; response: ApiResponse }>,
	reading: DimensionReading,
): ApiResponse => {
	const entries = answers.map(({ series, response }) => {
		const dimensions = describeMembers(reading.measure, series.dimensions);
		if ("data" in response.body)
			return {
				dimensions,
				...(series.datasetId ? { datasetId: series.datasetId } : {}),
				data: response.body.data,
			};
		return {
			dimensions,
			...(series.datasetId ? { datasetId: series.datasetId } : {}),
			problem: response.body,
		};
	});
	const answered = answers.find(({ response }) => "data" in response.body);
	const measure = {
		id: reading.measure.id,
		label: reading.measure.label,
		description: reading.measure.description,
	};
	// No series answered: the first one's refusal, with every entry's.
	if (!answered) {
		const first = answers[0]!;
		return {
			...first.response,
			headers: { ...first.response.headers, ...readingHeaders(reading) },
			body: {
				...first.response.body,
				breakdown: entries,
			} as unknown as ApiResponse["body"],
		};
	}
	const envelope = answered.response.body as Body;
	return {
		status: 200,
		headers: readingHeaders(reading),
		body: {
			...envelope,
			meta: { nextCursor: null },
			data: {
				measure,
				breakdown: entries,
				note: `${entries.length} series of ${reading.measure.id} answer this request, one entry each; each entry's dimensions say which. Name one member of each dimension for a single answer.`,
			},
		} as ApiResponse["body"],
	};
};
