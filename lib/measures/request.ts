import type { MeasureValuesRequest } from "./types";

/**
 * How a measure query is written in a URL, in one place for the client that
 * builds it and the route that reads it:
 *
 *   /data/measures/{measure}?geography=localAuthority&boundaryYear=2023
 *     &period=2022,2023&areas=E06000001,E06000002&dimensions[tenure]=owned
 *
 * The same request always writes the same URL, so a cache keyed on it works.
 */

export const MEASURE_VALUES_PATH = "/data/measures";
export const MAX_PERIODS = 40;
export const MAX_AREAS = 2000;

const DIMENSION_PARAMETER = /^dimensions\[([a-z0-9][a-z0-9-]*)\]$/;
/** A code or id, or `*` for every member of a dimension. */
const IDENTIFIER = /^(?:\*|[A-Za-z0-9][A-Za-z0-9._-]{0,63})$/;
const PERIOD = /^[A-Za-z0-9][A-Za-z0-9._ -]{0,31}$/;
const SINGLE = ["geography", "boundaryYear", "datasetId"] as const;
const LISTS = ["period", "areas"] as const;

const list = (values: readonly string[]) =>
	values.map(encodeURIComponent).join(",");

/** The URL that asks for a request, relative to the website's origin. */
export const measureValuesUrl = (request: MeasureValuesRequest): string => {
	const query: string[] = [];
	if (request.geography)
		query.push(`geography=${encodeURIComponent(request.geography)}`);
	if (request.boundaryYear !== undefined)
		query.push(`boundaryYear=${request.boundaryYear}`);
	if (request.datasetId)
		query.push(`datasetId=${encodeURIComponent(request.datasetId)}`);
	if (request.periods?.length) query.push(`period=${list(request.periods)}`);
	if (request.areas?.length) query.push(`areas=${list(request.areas)}`);
	for (const dimension of Object.keys(request.dimensions ?? {}).sort()) {
		const members = request.dimensions![dimension]!;
		if (members.length)
			query.push(`dimensions[${dimension}]=${list(members)}`);
	}
	const path = `${MEASURE_VALUES_PATH}/${encodeURIComponent(request.measure)}`;
	return query.length ? `${path}?${query.join("&")}` : path;
};

export type ParsedMeasureValuesQuery =
	{ ok: true; request: MeasureValuesRequest } | { ok: false; detail: string };

const split = (value: string) =>
	value.split(",").filter((part) => part.length > 0);

/** Read a request from a URL's query. Refuses what it does not understand. */
export const parseMeasureValuesQuery = (
	measure: string,
	params: URLSearchParams,
): ParsedMeasureValuesQuery => {
	const seen = new Set<string>();
	const dimensions: Record<string, string[]> = {};
	const request: MeasureValuesRequest = { measure };
	for (const [name, value] of params) {
		if (seen.has(name))
			return { ok: false, detail: `${name} may appear only once.` };
		seen.add(name);
		const dimension = DIMENSION_PARAMETER.exec(name)?.[1];
		if (dimension) {
			const members = split(value);
			if (
				members.length === 0 ||
				!members.every((m) => IDENTIFIER.test(m))
			)
				return {
					ok: false,
					detail: `${name} must list member codes separated by commas.`,
				};
			dimensions[dimension] = members;
			continue;
		}
		if (
			!(SINGLE as readonly string[]).includes(name) &&
			!(LISTS as readonly string[]).includes(name)
		)
			return {
				ok: false,
				detail: `${name} is not a parameter of this route.`,
			};
		if (name === "geography" || name === "datasetId") {
			if (!IDENTIFIER.test(value))
				return {
					ok: false,
					detail: `${name} is not a valid identifier.`,
				};
			request[name] = value;
		} else if (name === "boundaryYear") {
			if (!/^\d{4}$/.test(value))
				return {
					ok: false,
					detail: "boundaryYear must be a four digit year.",
				};
			request.boundaryYear = Number(value);
		} else if (name === "period") {
			const periods = split(value);
			if (
				periods.length === 0 ||
				periods.length > MAX_PERIODS ||
				!periods.every((period) => PERIOD.test(period))
			)
				return {
					ok: false,
					detail: `period must list up to ${MAX_PERIODS} periods separated by commas.`,
				};
			request.periods = periods;
		} else {
			const areas = split(value);
			if (
				areas.length === 0 ||
				areas.length > MAX_AREAS ||
				!areas.every((code) => IDENTIFIER.test(code))
			)
				return {
					ok: false,
					detail: `areas must list up to ${MAX_AREAS} area codes separated by commas.`,
				};
			request.areas = areas;
		}
	}
	if (Object.keys(dimensions).length > 0) request.dimensions = dimensions;
	return { ok: true, request };
};
