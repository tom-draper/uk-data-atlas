import type { ApiResponse } from "@uk-data-atlas/atlas-runtime/api";
import { describeMembers, type Series } from "./dimensionCatalogue";
import type { DimensionReading } from "./dimensionRequests";

/**
 * Responses to a request read through dimension filters. The route answered
 * for a series by its catalogue id; the response is restated in terms of the
 * measure and its members, and says what the API chose.
 */

type Body = Record<string, unknown>;

const isObject = (value: unknown): value is Body =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** A link to a series, rewritten to name its measure and members. */
const rewriteLink = (
	text: string,
	series: Series,
	reading: DimensionReading,
) => {
	const data = new RegExp(
		`/v1/data/${series.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[/?#"]|$)(/[A-Za-z:]+)?(\\?[^\\s"#]*)?`,
		"g",
	);
	const rewritten = text.replace(
		data,
		(_match, operation: string | undefined, search: string | undefined) => {
			const query = new URLSearchParams(search?.slice(1) ?? "");
			for (const [dimension, code] of Object.entries(series.dimensions))
				query.set(dimension, code);
			if (series.datasetId && !query.has("datasetId"))
				query.set("datasetId", series.datasetId);
			const rest = query.toString();
			return `/v1/data/${reading.measure.id}${operation ?? ""}${rest ? `?${rest}` : ""}`;
		},
	);
	return rewritten.replaceAll(
		`/v1/measures/${series.id}`,
		`/v1/measures/${reading.measure.id}`,
	);
};

/** Restate a route's data for the measure rather than its catalogue id. */
const restate = (
	value: unknown,
	series: Series,
	reading: DimensionReading,
	key?: string,
): unknown => {
	if (typeof value === "string")
		return series.id === reading.measure.id &&
			Object.keys(series.dimensions).length === 0 &&
			!series.datasetId
			? value
			: rewriteLink(value, series, reading);
	if (Array.isArray(value))
		return value.map((item) => restate(item, series, reading));
	if (!isObject(value)) return value;
	const restated: Body = {};
	for (const [name, item] of Object.entries(value)) {
		if (name === "measureId" && item === series.id) {
			restated[name] = reading.measure.id;
			continue;
		}
		restated[name] = restate(item, series, reading, name);
	}
	if (key === "measure" && value.id === series.id) {
		restated.id = reading.measure.id;
		if (typeof value.label === "string") {
			restated.label = reading.measure.label;
			restated.seriesLabel = value.label;
		}
	}
	return restated;
};

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
	const restated = restate(data, series, reading);
	if (!isObject(restated)) return restated;
	const defaulted = Object.keys(reading.defaulted).length > 0;
	const from = resolvedFrom(series, reading);
	return {
		...restated,
		dimensions: membersRead(series, reading),
		...(defaulted
			? {
					defaults: {
						...(isObject(restated.defaults)
							? restated.defaults
							: {}),
						...reading.defaulted,
					},
				}
			: {}),
		...(defaulted && typeof restated.note === "string"
			? { note: `${restated.note} ${defaultNote(reading)}` }
			: defaulted
				? { note: defaultNote(reading) }
				: {}),
		...(from ? { resolvedFrom: from } : {}),
	};
};

/** A route's answer for one series, restated for its measure and members. */
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
				...(restate(
					response.body,
					series,
					reading,
				) as typeof response.body),
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
				data: restate(response.body.data, series, reading),
			};
		return {
			dimensions,
			...(series.datasetId ? { datasetId: series.datasetId } : {}),
			problem: restate(response.body, series, reading),
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
				...(restate(
					first.response.body,
					first.series,
					reading,
				) as Body),
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
