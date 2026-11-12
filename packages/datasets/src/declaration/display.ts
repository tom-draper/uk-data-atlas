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
			prefix?: string;
			/** Text after the number, such as `%`. */
			suffix?: string;
	  }
	| {
			/** A whole number with thousands separators. */
			kind: "count";
			locale?: string;
			/** Round to a whole number first. */
			round?: true;
			prefix?: string;
			suffix?: string;
	  }
	| { kind: "compact"; suffix?: string }
	| {
			/**
			 * A rank out of `of`, where a low value is the most deprived but is
			 * drawn at the high end of the scale: written as "Most deprived",
			 * "Least deprived" or "Rank n".
			 */
			kind: "rank";
			of: number;
	  }
	| {
			/**
			 * A sum of money in millions, written as `£1.2bn` from a thousand
			 * million up and `£340m` below.
			 */
			kind: "millions";
			prefix?: string;
			suffix?: string;
	  };

/** How a measure's headline value is drawn on the shared chart card. */
export type DisplayMeasureCard = {
	/** The unit shown under the headline value. */
	unit?: string;
	prefix?: string;
	/** Decimal places of the headline value. */
	digits?: number;
	/** Writes the headline value, replacing `prefix` and `digits`. */
	format?: DisplayFormat;
	/**
	 * Where the headline value comes from, when it is not the measure's own
	 * field. A card also draws an aggregate, which may hold fewer fields than a
	 * record does.
	 */
	field?: DisplayField;
	/** The value that fills the card's bar. */
	maximum: number;
	/** Replaces the card's heading for this measure. */
	heading?: string;
	/** Replaces the card's period for this measure. */
	period?: string;
	/** A fixed note under the headline for this measure. */
	note?: string;
	/** Treat a value of zero as missing, where the source writes zero for "not attributed". */
	zeroIsMissing?: true;
};

/**
 * Where a measure's value comes from in a record: a field's path, `of` as a
 * percentage of `over`, or `amount` apportioned to the share `part` is of
 * `whole` (`amount × part ÷ whole`), such as a rate for the whole area applied
 * to one part of it. An apportioned part of nothing is zero when the part is
 * zero, and missing otherwise.
 */
export type DisplayField =
	| string
	| { share: { of: string; over: string } }
	| { apportion: { amount: string; part: string; whole: string } };

/** One way to read the dataset, shown as a choice when there is more than one. */
export type DisplayMeasure = {
	/** Stored in the URL and map options; the first measure is the default. */
	id: string;
	/** The choice's label. */
	label: string;
	/**
	 * Where the value comes from: the path of a record field, or a share of
	 * one field over another, as a percentage.
	 */
	field: DisplayField;
	/** The colour range the map starts with. */
	colorRange: { min: number; max: number };
	/** The legend's full range and the text of its labels. */
	legend: { min: number; max: number; format: DisplayFormat };
	/** Needed when the dataset is drawn by the shared chart card. */
	card?: DisplayMeasureCard;
	/**
	 * Set to false where a low value should take the low end of the colour
	 * scale, as for a rank. The first measure decides for the dataset.
	 */
	invertColor?: false;
};

export type DisplayCard = {
	heading: string;
	/** Shown in brackets after the heading; defaults to the dataset's year. */
	period?: string;
	/** The source and method note shown as the card's tooltip. */
	source: string;
	/** The nations the source covers, when the compiled dataset does not say. */
	coverage?: string;
	/**
	 * A note under the headline, from another field of the record. With
	 * `versus`, the note reads `field vs versus`, and is omitted unless both exist.
	 */
	secondary?: { field: string; format: DisplayFormat; versus?: string };
	/** A fixed note beside the value. */
	secondaryText?: string;
	/** Leave out the fixed note when this record field is true, as on an average. */
	secondaryHiddenWhen?: string;
	/** Use a hovered map record when no matching area record is available. */
	hoverRecord?: boolean;
	/** Keep the card on this measure when the map switches measures. */
	fixedMeasure?: string;
	/** How the card looks, where it differs from the standard card. */
	appearance?: {
		/** The decorative background the income chart also uses. */
		background?: "income";
		/** Centres the headline value without a bar or note. */
		layout?: "centered";
		/** A fixed highlight colour, instead of the map's colour scale. */
		accent?: string;
	};
};

/** Combining records over the areas a place is made of. */
export type DisplayAggregation = {
	scope: BoundaryType | "any";
	/** Count an area once however many boundary features carry its code. */
	distinct?: true;
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
	/**
	 * The shared chart card. Absent when `component` draws the chart, which a
	 * dataset needs only when its chart is more than one headline value.
	 */
	card?: DisplayCard;
	/**
	 * The website module of a chart component of its own, such as
	 * `@/components/telecoms/broadband/BroadbandChart`.
	 */
	component?: string;
	/**
	 * Name of a compiled dataset field mapping an area code to the key of the
	 * record that describes it, for a dataset published for larger areas than
	 * the map's, such as NHS boards. Absent, records are keyed by area code.
	 */
	recordsVia?: string;
	/** Never empty; the first is the default. */
	measures: readonly [DisplayMeasure, ...DisplayMeasure[]];
	aggregation: DisplayAggregation;
};
