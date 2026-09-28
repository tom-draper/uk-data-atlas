import type { Measure, PopulationObservation } from "./dataCatalog";

/**
 * How change between two periods is measured and ranked. `absolute` is the end
 * value less the start, in the measure's own unit. `relative` is that change as
 * a share of the start value, which is only offered where a share of the start
 * means something.
 */
export type ChangeBasis = "absolute" | "relative";

export type PeriodSpan = { firstYear: number; lastYear: number };

/**
 * The years a period covers. Most are single years; life expectancy is
 * published for rolling three-year windows written `2001-2003`. Anything else
 * cannot be placed in time and is treated as its own span, overlapping nothing.
 */
export const periodSpan = (period: string): PeriodSpan | undefined => {
	const single = /^(\d{4})$/.exec(period);
	if (single) {
		const year = Number(single[1]);
		return { firstYear: year, lastYear: year };
	}
	const range = /^(\d{4})-(\d{4})$/.exec(period);
	if (range) {
		return { firstYear: Number(range[1]), lastYear: Number(range[2]) };
	}
	return undefined;
};

/**
 * Whether two periods share any year. Rolling windows next to each other do:
 * 2017-2019 and 2018-2020 hold two of their three years in common, so most of
 * what looks like change between them is the same deaths counted twice.
 */
export const periodsOverlap = (left: string, right: string): boolean => {
	const a = periodSpan(left);
	const b = periodSpan(right);
	if (!a || !b) return false;
	return a.firstYear <= b.lastYear && b.firstYear <= a.lastYear;
};

/**
 * Why a measure cannot show change at all, or undefined if it can.
 *
 * A category has no difference. A rank or decile records a position among the
 * other areas, so a move says as much about them as about the area itself, and
 * a single area can rise without anything in it improving.
 */
export const changeRefusal = (measure: Measure): string | undefined => {
	if (measure.valueKind === "categorical") {
		return "Categorical measures have no numeric change between periods.";
	}
	if (measure.valueKind === "ordinal") {
		return "A rank or decile is a position among the other areas, not a quantity, so a move between periods is not a change in the area itself.";
	}
	return undefined;
};

/**
 * Why relative change is not offered for a measure, or undefined if it is.
 *
 * Change in a ratio is reported in the ratio's own unit. For a share, a relative
 * figure misleads: 5G coverage going from 2% to 3% is a rise of one point, and
 * calling it 50% overstates it. Density is a ratio that is not a share, and
 * could bear a relative change, but the rule is kept to the value kind so it
 * matches the one `compare` applies between two areas.
 */
export const relativeChangeRefusal = (measure: Measure): string | undefined =>
	measure.valueKind === "ratio"
		? "This measure is a ratio, so its change is reported in the ratio's own unit, as compare does between two areas. Relative change of a ratio is not offered: for a share such as coverage it would read a rise from 2% to 3% as 50%. Use by=absolute."
		: undefined;

export type AreaChange = {
	areaCode: string;
	start: PopulationObservation;
	end: PopulationObservation;
	absoluteChange: number;
	/** Null where the start is zero, or the measure is a ratio. */
	relativeChange: number | null;
	/**
	 * Whether the start and end intervals overlap, where both are published.
	 * Intervals that do not overlap mean the change is unlikely to be chance;
	 * intervals that do overlap do not prove it is.
	 */
	intervalsOverlap?: boolean;
};

export type ChangeSet = {
	changes: AreaChange[];
	/** Areas with a value at the start and none at the end. */
	onlyAtStart: string[];
	/** Areas with a value at the end and none at the start. */
	onlyAtEnd: string[];
};

/**
 * Change for every area with a value in both periods.
 *
 * Both periods come from one source partition, restated by the publisher on a
 * single set of codes, so an area code means the same ground at the start and
 * the end. An area in only one period is set aside and counted rather than
 * paired with anything.
 */
export const computeChanges = (
	measure: Measure,
	startRecords: PopulationObservation[],
	endRecords: PopulationObservation[],
): ChangeSet => {
	const endByCode = new Map(
		endRecords.map((record) => [record.areaCode, record]),
	);
	const startCodes = new Set(startRecords.map((record) => record.areaCode));
	const relativeAllowed = relativeChangeRefusal(measure) === undefined;
	const changes: AreaChange[] = [];
	const onlyAtStart: string[] = [];
	for (const start of startRecords) {
		const end = endByCode.get(start.areaCode);
		if (!end) {
			onlyAtStart.push(start.areaCode);
			continue;
		}
		const absoluteChange = end.value - start.value;
		const startInterval = start.confidenceInterval;
		const endInterval = end.confidenceInterval;
		changes.push({
			areaCode: start.areaCode,
			start,
			end,
			absoluteChange,
			relativeChange:
				relativeAllowed && start.value !== 0
					? absoluteChange / start.value
					: null,
			...(startInterval && endInterval
				? {
						intervalsOverlap:
							startInterval.lower <= endInterval.upper &&
							endInterval.lower <= startInterval.upper,
					}
				: {}),
		});
	}
	const onlyAtEnd = endRecords
		.filter((record) => !startCodes.has(record.areaCode))
		.map((record) => record.areaCode);
	return {
		changes,
		onlyAtStart: onlyAtStart.sort(),
		onlyAtEnd: onlyAtEnd.sort(),
	};
};

/** The value a change is ranked on, or undefined where it has none. */
export const changeValue = (
	change: AreaChange,
	basis: ChangeBasis,
): number | undefined =>
	basis === "absolute"
		? change.absoluteChange
		: (change.relativeChange ?? undefined);
