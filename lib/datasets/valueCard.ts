import type { NumericMapOptionsKey } from "@/lib/types/mapOptions";

/** The figures a value card shows, whichever area or aggregate they came from. */
export interface ValueCardStats {
	value: number;
	secondary?: string;
}

/**
 * A declarative chart card: one headline value with a proportional bar and an
 * optional secondary note. Datasets that fit this shape describe it here
 * rather than shipping their own component, so area resolution (including a
 * ward rolling up to its local authority) is written once.
 */
export interface ValueCardConfig {
	heading: string;
	/** Shown in brackets after the heading; defaults to the dataset's year. */
	period?: string;
	/** Full heading for the tooltip when the visible one may be truncated. */
	headingTitle?: string;
	/** The nations the source covers, shown in the card's header. */
	coverage?: string;
	/** Source and methodology note shown as the card's tooltip. */
	source: string;
	unit?: string;
	prefix?: string;
	/** Decimal places for the headline value; defaults to 0. */
	digits?: number;
	/** Formats the headline value, replacing prefix and digits. */
	format?(value: number): string;
	/** The value that fills the bar. */
	maximum: number;
	/** Map options entry whose colour scale tints the card; defaults to the dataset type. */
	colorKey?: NumericMapOptionsKey;
	/** Figures for an area code of the dataset's boundary type, or null. */
	fromRecord(dataset: unknown, code: string): ValueCardStats | null;
	/** Figures for the aggregate shown when no area is selected. */
	fromAggregate(aggregate: unknown): ValueCardStats | null;
	/** Figures read from the map's own hover record, for the active dataset. */
	fromHover?(data: unknown): ValueCardStats | null;
}

type Display = Omit<
	ValueCardConfig,
	"fromRecord" | "fromAggregate" | "fromHover"
>;

type ValueCardSpec<T, S, A> = Display & {
	/** Finds an area's record; defaults to `dataset.data[code]`. */
	lookup?(dataset: T, code: string): S | undefined;
	/** Maps the aggregate onto the record shape; defaults to using it as is. */
	aggregate?(aggregate: A): S | null | undefined;
	value(stats: S): number | null | undefined;
	secondary?(stats: S): string | undefined;
	/** Reads the map hover record as a record when nothing else matches. */
	hoverRecord?: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

/**
 * Builds a value card from typed accessors. `S` is the record shape the
 * accessors read; `A`, the aggregate's shape, is the same unless the dataset
 * aggregates to something else.
 */
export function defineValueCard<
	T extends { data: Record<string, S> },
	S,
	A = S,
>({
	lookup,
	aggregate,
	value,
	secondary,
	hoverRecord,
	...display
}: ValueCardSpec<T, S, A>): ValueCardConfig {
	const stats = (record: S | null | undefined): ValueCardStats | null => {
		if (record === null || record === undefined) return null;
		const headline = value(record);
		if (headline === null || headline === undefined) return null;
		if (!Number.isFinite(headline)) return null;
		return { value: headline, secondary: secondary?.(record) };
	};
	return {
		...display,
		fromRecord: (dataset, code) =>
			stats(
				lookup ? lookup(dataset as T, code) : (dataset as T).data[code],
			),
		fromAggregate: (data) =>
			stats(aggregate ? aggregate(data as A) : (data as S)),
		...(hoverRecord
			? {
					fromHover: (data: unknown) =>
						isRecord(data) ? stats(data as S) : null,
				}
			: {}),
	};
}
