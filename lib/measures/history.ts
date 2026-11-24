import { loadMeasureValues } from "./cache";
import { ALL_PERIODS, MAX_PERIODS } from "./request";
import {
	isNumericColumn,
	type MeasureColumn,
	type MeasureValuesPayload,
	type MeasureValuesRequest,
} from "./types";

/**
 * A measure's whole history. The route reads at most `MAX_PERIODS` periods
 * a request, so a longer history, such as a monthly count over a decade, is
 * read as its newest periods and then the older ones a request's worth at a
 * time, and the answers joined into one.
 */

/** The periods the source publishes that the answer left out, in requests of at most `MAX_PERIODS`. */
export function olderPeriodChunks(payload: MeasureValuesPayload): string[][] {
	const read = new Set(payload.periods);
	const older = payload.source.periods.filter((period) => !read.has(period));
	const chunks: string[][] = [];
	for (let at = 0; at < older.length; at += MAX_PERIODS)
		chunks.push(older.slice(at, at + MAX_PERIODS));
	return chunks;
}

/**
 * Answers for the same measure and source over different periods as one:
 * every area any of them holds, sorted as the route sorts them, and each
 * period in the source's order. Statuses are matched by name, since each
 * answer numbers its own.
 */
export function joinPeriods(
	payloads: readonly MeasureValuesPayload[],
): MeasureValuesPayload {
	const [first, ...rest] = payloads;
	if (!first) throw new Error("No answers to join.");
	if (rest.length === 0) return first;
	const areas = [...new Set(payloads.flatMap((p) => p.areas))].sort();
	const statuses = [...new Set(payloads.flatMap((p) => p.statuses))];
	const missing = statuses.indexOf("missing");
	const order = new Map(
		first.source.periods.map((period, at) => [period, at]),
	);
	const columns: MeasureColumn[] = [];
	for (const payload of payloads) {
		const at = new Map(payload.areas.map((code, index) => [code, index]));
		const positions = areas.map((code) => at.get(code) ?? -1);
		const status = payload.statuses.map((name) => statuses.indexOf(name));
		const pick = <T>(values: readonly T[], absent: T): T[] =>
			positions.map((index) =>
				index === -1 ? absent : (values[index] ?? absent),
			);
		for (const column of payload.columns) {
			const remapped = pick(column.status, -1).map((index) =>
				index === -1 ? missing : status[index]!,
			);
			columns.push(
				isNumericColumn(column)
					? {
							period: column.period,
							values: pick(column.values, null),
							status: remapped,
							...(column.lower
								? { lower: pick(column.lower, null) }
								: {}),
							...(column.upper
								? { upper: pick(column.upper, null) }
								: {}),
						}
					: {
							period: column.period,
							categories: pick(column.categories, null),
							status: remapped,
						},
			);
		}
	}
	columns.sort(
		(a, b) =>
			(order.get(a.period) ?? Infinity) -
			(order.get(b.period) ?? Infinity),
	);
	const extents = payloads.flatMap((p) => (p.extent ? [p.extent] : []));
	return {
		...first,
		statuses,
		periods: columns.map((column) => column.period),
		areas,
		columns,
		extent: extents.length
			? {
					min: Math.min(...extents.map((e) => e.min)),
					max: Math.max(...extents.map((e) => e.max)),
				}
			: null,
	};
}

/** Every period of a measure's source, for every area, read once per page. */
export async function loadMeasureHistory(
	request: Omit<MeasureValuesRequest, "areas" | "periods" | "parents">,
): Promise<MeasureValuesPayload> {
	const latest = await loadMeasureValues({
		...request,
		periods: [ALL_PERIODS],
	});
	const chunks = olderPeriodChunks(latest);
	if (chunks.length === 0) return latest;
	const older = await Promise.all(
		chunks.map((periods) => loadMeasureValues({ ...request, periods })),
	);
	return joinPeriods([...older, latest]);
}
