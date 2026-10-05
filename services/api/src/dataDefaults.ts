import type { Measure, MeasureSource } from "./dataCatalog";
import type { GeographyResolver } from "./geographyResolver";
import type { PlaceCandidate } from "./placeResolver";
import { describeCandidate } from "./placeResponses";
import { problem, type ApiResponse } from "./routeResponse";
import { periodsOverlap } from "./change";

type SourceQuery = {
	period?: string | null;
	geography?: string | null;
	boundaryYear?: string | null;
	datasetId?: string | null;
};

export type DefaultedSource = {
	source: MeasureSource;
	period: string;
	geography: string;
	boundaryYear: string;
	/** Parameters the caller omitted and the route selected deliberately. */
	defaulted: Record<string, string | number>;
};

/**
 * Select the current source partition without making catalogue order part of
 * the public API.  A newer source-boundary vintage wins; within it the source's
 * last declared period wins.  Two datasets on that same current partition are
 * intentionally left ambiguous, so callers still have to name datasetId.
 */
export const defaultSource = (
	measure: Measure,
	query: SourceQuery,
	periods: string[] = query.period ? [query.period] : [],
	includePeriod = true,
): DefaultedSource | undefined => {
	const candidates = measure.sources.filter(
		(source) =>
			(query.geography == null ||
				source.sourceGeography.type === query.geography) &&
			(query.boundaryYear == null ||
				String(source.sourceGeography.boundaryYear) ===
					query.boundaryYear) &&
			(query.datasetId == null || source.datasetId === query.datasetId) &&
			periods.every((period) => source.periods.includes(period)),
	);
	if (candidates.length === 0) return undefined;
	// Geographies are not newer or older than one another: a ranking of
	// constituencies is no more current than one of local authorities. So
	// the geography is chosen only when the measure leaves no choice.
	if (
		query.geography == null &&
		new Set(candidates.map((source) => source.sourceGeography.type)).size >
			1
	)
		return undefined;
	const newestYear = Math.max(
		...candidates.map((source) => source.sourceGeography.boundaryYear),
	);
	const current = candidates.filter(
		(source) => source.sourceGeography.boundaryYear === newestYear,
	);
	// More than one data product can legitimately share a geography and source
	// vintage.  It is not safe to choose one merely because it happened to be
	// listed first in the catalogue.
	if (
		query.datasetId == null &&
		new Set(current.map((source) => source.datasetId)).size > 1
	)
		return undefined;
	const source = current[0]!;
	const period = query.period ?? source.periods.at(-1);
	if (!period) return undefined;
	return {
		source,
		period,
		geography: source.sourceGeography.type,
		boundaryYear: String(source.sourceGeography.boundaryYear),
		defaulted: {
			...(includePeriod && query.period == null ? { period } : {}),
			...(query.geography == null
				? { geography: source.sourceGeography.type }
				: {}),
			...(query.boundaryYear == null
				? { boundaryYear: source.sourceGeography.boundaryYear }
				: {}),
		},
	};
};

/**
 * The periods a change runs between when one or both are left out. The end
 * is the latest period, since "since 2011" means to now; the start is the
 * latest before the end that does not overlap it, so a change with neither
 * is the most recent one. Overlapping windows are skipped because most of
 * the change between them is the same data counted twice.
 */
export const defaultChangePeriods = (
	source: MeasureSource,
	start: string | null,
	end: string | null,
):
	| { start: string; end: string; defaulted: Record<string, string> }
	| undefined => {
	if (start && end) return { start, end, defaulted: {} };
	const periods = source.periods;
	if (start) {
		const latest = [...periods]
			.reverse()
			.find(
				(period) =>
					periods.indexOf(period) > periods.indexOf(start) &&
					!periodsOverlap(start, period),
			);
		return latest
			? { start, end: latest, defaulted: { endPeriod: latest } }
			: undefined;
	}
	const ends = end ? [end] : [...periods].reverse();
	for (const last of ends) {
		const previous = periods
			.slice(0, periods.indexOf(last))
			.reverse()
			.find((period) => !periodsOverlap(period, last));
		if (previous)
			return {
				start: previous,
				end: last,
				defaulted: end
					? { startPeriod: previous }
					: { startPeriod: previous, endPeriod: last },
			};
	}
	return undefined;
};

const listed = (items: string[], last: string) =>
	items.length < 2
		? items.join("")
		: `${items.slice(0, -1).join(", ")} ${last} ${items.at(-1)}`;

const defaultNote = (entries: [string, string | number][]) =>
	`No ${listed(
		entries.map(([parameter]) => parameter),
		"or",
	)} was given, so the current published ${listed(
		entries.map(([parameter, value]) => `${parameter}=${value}`),
		"and",
	)} ${entries.length === 1 ? "was" : "were"} used.`;

/**
 * The fields a response states its defaults in, `defaults` and a `note`
 * saying the same in words, or none when the caller chose everything.
 */
export const statedDefaults = (
	defaulted: Record<string, string | number> | undefined,
): { defaults?: Record<string, string | number>; note?: string } => {
	const entries = Object.entries(defaulted ?? {});
	return entries.length === 0
		? {}
		: { defaults: defaulted, note: defaultNote(entries) };
};

/** Each partition a measure publishes, for a refusal that asks for one. */
export const publishedPartitions = (measure: Measure) =>
	measure.sources
		.map(
			(source) =>
				`geography=${source.sourceGeography.type}&boundaryYear=${source.sourceGeography.boundaryYear} (${source.periods.length} period${source.periods.length === 1 ? "" : "s"})`,
		)
		.join("; ");

export type NamedArea =
	| { kind: "area"; code: string; geography: string }
	| { kind: "ambiguous"; candidates: PlaceCandidate[] }
	| { kind: "unknown" };

// An area code has a digit in it: "Leeds" is a name, 00DA and E08000035
// are codes.
const CODE_LIKE = /^(?=.*\d)[A-Z0-9]{4,9}$/i;

/**
 * A data route accepts the same area names and codes as `/value`, among the
 * areas the measure is published for: those of its geographies whose code
 * was in use in the code vintage of one of its partitions, so a name does
 * not also mean a council's code from before it was recoded. A code that
 * names no such area is left as it was given, so the route's own refusal
 * for an unknown code still answers it.
 */
export const areaNamedBy = ({
	geographyResolver,
	measure,
	place,
	geography,
	boundaryYear = null,
}: {
	geographyResolver: GeographyResolver;
	measure: Measure;
	place: string | null;
	geography: string | null;
	boundaryYear?: string | null;
}): NamedArea | undefined => {
	if (!place || place.includes("/")) return undefined;
	const sources = measure.sources.filter(
		(source) =>
			(geography === null || source.sourceGeography.type === geography) &&
			(boundaryYear === null ||
				String(source.sourceGeography.boundaryYear) === boundaryYear),
	);
	const candidates = geographyResolver
		.places(place, 12)
		.filter(
			(candidate) =>
				candidate.kind === "area" &&
				candidate.match !== "prefix" &&
				sources.some(
					(source) =>
						source.sourceGeography.type === candidate.geography,
				),
		);
	const inVintage = candidates.filter((candidate) =>
		sources.some(
			(source) =>
				source.sourceGeography.type === candidate.geography &&
				candidate.boundaryReleases.some((release) =>
					release.startsWith(
						`${source.sourceGeography.boundaryYear}-`,
					),
				),
		),
	);
	const found = inVintage.length > 0 ? inVintage : candidates;
	if (found.length === 0)
		return CODE_LIKE.test(place) ? undefined : { kind: "unknown" };
	if (found.length > 1) return { kind: "ambiguous", candidates: found };
	const [only] = found;
	return { kind: "area", code: only!.code, geography: only!.geography };
};

/**
 * The refusal for a name that means no area the measure is published for,
 * or several. Each choice comes with the request that asks about it alone:
 * the same request, with the area's code and geography in place of the name.
 */
export const namedAreaRefusal = ({
	parsedUrl,
	measure,
	parameter,
	text,
	named,
}: {
	parsedUrl: URL;
	measure: Measure;
	parameter: string;
	text: string | null;
	named: NamedArea | undefined;
}): ApiResponse | undefined => {
	if (named?.kind === "unknown")
		return problem(
			404,
			"Unknown Place",
			`"${text}" names no area ${measure.id} is published for. It is published for ${[...new Set(measure.sources.map((source) => source.sourceGeography.type))].join(", ")}; GET /v1/places?q= finds an area's code, and /v1/data/${measure.id}/value?place= answers a larger place where the measure can be summed.`,
		);
	if (named?.kind !== "ambiguous") return undefined;
	return problem(
		409,
		"Ambiguous Place",
		`"${text}" names ${named.candidates.length} areas ${measure.id} is published for. Ask again with the code of the one meant.`,
		{
			code: "ambiguous_place",
			choices: named.candidates.map((candidate) => {
				const search = new URLSearchParams(parsedUrl.searchParams);
				search.set(parameter, candidate.code);
				search.set("geography", candidate.geography);
				return {
					...describeCandidate(candidate),
					ask: `${parsedUrl.pathname}?${search}`,
				};
			}),
		},
	);
};
