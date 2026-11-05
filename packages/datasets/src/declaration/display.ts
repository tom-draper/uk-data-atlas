import type { BoundaryType } from "../data/boundaries/catalog.ts";

/**
 * How the website shows a dataset, as data. The website builds the chart
 * card, map colouring, legend, measure toggle and default options from this,
 * so a dataset that fits needs no website code.
 */

/** A number's text. Each kind is written once, by the website. */
export type DisplayFormat =
	| {
			kind: "decimal";
			digits: number;
			/** Text after the number, such as `%`. */
			suffix?: string;
	  }
	| {
			/** A whole number with thousands separators. */
			kind: "count";
			suffix?: string;
	  }
	| { kind: "compact" };

/** One way to read the dataset, shown as a choice when there is more than one. */
export type DisplayMeasure = {
	/** Stored in the URL and map options; the first measure is the default. */
	id: string;
	/** The choice's label. */
	label: string;
	/** Path of the record field holding the value. */
	field: string;
	/** The unit shown under the headline value. */
	unit: string;
	/** Decimal places of the headline value. */
	digits?: number;
	/** The value that fills the card's bar. */
	maximum: number;
	/** The colour range the map starts with. */
	colorRange: { min: number; max: number };
	/** The legend's full range and the text of its labels. */
	legend: { min: number; max: number; format: DisplayFormat };
};

export type DisplayCard = {
	heading: string;
	/** The source and method note shown as the card's tooltip. */
	source: string;
	/** The nations the source covers, when the compiled dataset does not say. */
	coverage?: string;
	/** A note under the headline, from another field of the record. */
	secondary?: { field: string; format: DisplayFormat };
};

/** Combining records over the areas a place is made of. */
export type DisplayAggregation = {
	scope: BoundaryType | "any";
	/** Pure, so a worker can run it. Returns null when no record counts. */
	aggregate: (records: never[]) => unknown;
};

export type DatasetDisplay = {
	/** The chart group the card is listed under. */
	group: string;
	/** The chart's label in the data list. */
	label: string;
	defaultVisible: boolean;
	/** The edition shown first. */
	year: number;
	card: DisplayCard;
	/** Never empty; the first is the default. */
	measures: readonly [DisplayMeasure, ...DisplayMeasure[]];
	aggregation: DisplayAggregation;
};
