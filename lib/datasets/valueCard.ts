import type { NumericMapOptionsKey } from "@/lib/types/mapOptions";

/** The figures a value card shows, whichever area or aggregate they came from. */
export interface ValueCardStats {
	value: number;
	secondary?: string;
	/** Small figures beside the headline, for the `pills` layout. */
	pills?: ValueCardPill[];
}

export interface ValueCardPill {
	label: string;
	value: number | null;
	unit: string;
	digits: number;
}

/**
 * A declarative chart card: one headline value with a proportional bar and an
 * optional secondary note. Datasets that fit this shape describe it here
 * rather than shipping their own component, so area resolution (including a
 * ward rolling up to its local authority) is written once.
 */
export interface ValueCardConfig {
	heading: string;
	/** Optional decorative background shared with the income chart. */
	background?: "income";
	/** Centres the headline value without a bar or secondary text, or sets it beside pills. */
	layout?: "centered" | "pills";
	/** Fixed card highlight colour; otherwise uses the map colour scale. */
	accent?: string;
	/** Shown in brackets after the heading; defaults to the dataset's year. */
	period?: string;
	/** Full heading for the tooltip when the visible one may be truncated. */
	headingTitle?: string;
	/** The nations the source covers, shown after the source in the card's tooltip. */
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
	/**
	 * Figures for a local authority's LSOAs combined, for an LSOA dataset a
	 * ward or authority is shown through.
	 */
	fromLsoas?(records: unknown[]): ValueCardStats | null;
	/** Figures read from the map's own hover record, for the active dataset. */
	fromHover?(data: unknown): ValueCardStats | null;
}

type Display = Omit<
	ValueCardConfig,
	"fromRecord" | "fromAggregate" | "fromHover" | "fromLsoas"
>;

type ValueCardSpec<T, S, A> = Display & {
	/** Finds an area's record; defaults to `dataset.data[code]`. */
	lookup?(dataset: T, code: string): S | undefined;
	/** Maps the aggregate onto the record shape; defaults to using it as is. */
	aggregate?(aggregate: A): S | null | undefined;
	value(stats: S): number | null | undefined;
	secondary?(stats: S): string | undefined;
	pills?(stats: S): ValueCardPill[];
	/** Reads the map hover record as a record when nothing else matches. */
	hoverRecord?: boolean;
	/** Combines LSOA records into the aggregate shape, for `fromLsoas`. */
	combineLsoas?(records: S[]): A | null | undefined;
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
	pills,
	hoverRecord,
	combineLsoas,
	...display
}: ValueCardSpec<T, S, A>): ValueCardConfig {
	const stats = (record: S | null | undefined): ValueCardStats | null => {
		if (record === null || record === undefined) return null;
		const headline = value(record);
		if (headline === null || headline === undefined) return null;
		if (!Number.isFinite(headline)) return null;
		return {
			value: headline,
			secondary: secondary?.(record),
			...(pills ? { pills: pills(record) } : {}),
		};
	};
	return {
		...display,
		fromRecord: (dataset, code) =>
			stats(
				lookup ? lookup(dataset as T, code) : (dataset as T).data[code],
			),
		fromAggregate: (data) =>
			stats(aggregate ? aggregate(data as A) : (data as S)),
		...(combineLsoas
			? {
					fromLsoas: (records: unknown[]) => {
						const combined = combineLsoas(records as S[]);
						return combined === null || combined === undefined
							? null
							: stats(
									aggregate
										? aggregate(combined)
										: (combined as unknown as S),
								);
					},
				}
			: {}),
		...(hoverRecord
			? {
					fromHover: (data: unknown) =>
						isRecord(data) ? stats(data as S) : null,
				}
			: {}),
	};
}
