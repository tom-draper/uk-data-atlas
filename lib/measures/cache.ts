import { fetchMeasureValues, MeasureQueryError } from "./client";
import { measureValuesUrl } from "./request";
import {
	isNumericColumn,
	type MeasureColumn,
	type MeasureValuesPayload,
	type MeasureValuesRequest,
} from "./types";

/**
 * The website's measure answers, shared by every card on the page. Each
 * answer is read for every area of its source at once, so moving the map or
 * picking another area reads nothing new: the cards filter what they hold to
 * the areas they show. A refusal is kept too, since asking again would be
 * refused again; a failure of the network is forgotten so it can be retried.
 */

/** Answers kept at once. Each is one measure's table for one geography. */
const MAX_ENTRIES = 96;

const answers = new Map<string, Promise<MeasureValuesPayload>>();

/** A measure's values for every area of its source, read once per page. */
export function loadMeasureValues(
	request: Omit<MeasureValuesRequest, "areas">,
): Promise<MeasureValuesPayload> {
	const url = measureValuesUrl(request);
	const known = answers.get(url);
	if (known) {
		answers.delete(url);
		answers.set(url, known);
		return known;
	}
	const answer = fetchMeasureValues(request);
	answers.set(url, answer);
	answer.catch((error: unknown) => {
		if (!(error instanceof MeasureQueryError && error.status < 500))
			answers.delete(url);
	});
	while (answers.size > MAX_ENTRIES)
		answers.delete(answers.keys().next().value!);
	return answer;
}

/** Forget every answer. For tests. */
export function clearMeasureValues() {
	answers.clear();
}

/**
 * The payload as the route would answer for these areas alone: the areas in
 * the order given, without repeats, missing where the source has no value.
 */
export function restrictToAreas(
	payload: MeasureValuesPayload,
	areas: readonly string[],
): MeasureValuesPayload {
	const codes = [...new Set(areas)];
	const index = new Map(payload.areas.map((code, at) => [code, at]));
	const positions = codes.map((code) => index.get(code) ?? -1);
	let statuses = payload.statuses;
	let missing = statuses.indexOf("missing");
	if (missing === -1 && positions.includes(-1)) {
		statuses = [...statuses, "missing"];
		missing = statuses.length - 1;
	}
	const pick = <T>(values: readonly T[], absent: T): T[] =>
		positions.map((at) => (at === -1 ? absent : (values[at] ?? absent)));
	let min = Infinity;
	let max = -Infinity;
	const columns = payload.columns.map((column): MeasureColumn => {
		const status = pick(column.status, missing);
		if (!isNumericColumn(column))
			return {
				period: column.period,
				categories: pick(column.categories, null),
				status,
			};
		const values = pick(column.values, null);
		for (const value of values)
			if (value !== null && Number.isFinite(value)) {
				if (value < min) min = value;
				if (value > max) max = value;
			}
		return {
			period: column.period,
			values,
			status,
			...(column.lower ? { lower: pick(column.lower, null) } : {}),
			...(column.upper ? { upper: pick(column.upper, null) } : {}),
		};
	});
	return {
		...payload,
		statuses,
		areas: codes,
		columns,
		extent: max >= min ? { min, max } : null,
	};
}
