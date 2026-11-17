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
	  }
	| {
			/** A value in whole thousands, written as `£250k`. */
			kind: "thousands";
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
	/** A note from another field of the record, for this measure only. */
	secondary?: { field: string; format: DisplayFormat; versus?: string };
	/** Treat a value of zero as missing, where the source writes zero for "not attributed". */
	zeroIsMissing?: true;
};

/**
 * Where a measure's value comes from in a record: a field's path, `of` as a
 * percentage of `over`, or `amount` apportioned to the share `part` is of
 * `whole` (`amount × part ÷ whole`), such as a rate for the whole area applied
 * to one part of it. An apportioned part of nothing is zero when the part is
 * zero, and missing otherwise. `mean` is the plain mean of several fields,
 * missing unless every one exists.
 */
export type DisplayField =
	| string
	| { share: { of: string; over: string } }
	| { apportion: { amount: string; part: string; whole: string } }
	| { mean: readonly string[] };

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
	/**
	 * Colour the map over the lowest and highest value in the dataset, not the
	 * range above, which then only starts the range control.
	 */
	rangeFromData?: true;
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

/** A small labelled figure drawn beside the headline of a pill card. */
export type DisplayPill = {
	label: string;
	/** The record field the figure reads. */
	field: string;
	unit: string;
	/** Decimal places of the figure. */
	digits: number;
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
	/** Small figures beside the headline, for the `pills` layout. */
	pills?: DisplayPill[];
	/** A fixed note beside the value. */
	secondaryText?: string;
	/** Leave out the fixed note when this record field is true, as on an average. */
	secondaryHiddenWhen?: string;
	/** Use a hovered map record when no matching area record is available. */
	hoverRecord?: boolean;
	/**
	 * For a dataset held by LSOA: a ward or local authority shows its
	 * authority's LSOAs combined by the dataset's aggregation, not one record.
	 */
	summariseLsoas?: "localAuthority";
	/** Keep the card on this measure when the map switches measures. */
	fixedMeasure?: string;
	/** How the card looks, where it differs from the standard card. */
	appearance?: {
		/** The decorative background the income chart also uses. */
		background?: "income";
		/**
		 * Centres the headline value without a bar or note (`centered`), or
		 * draws the headline beside the card's `pills` instead of a bar (`pills`).
		 */
		layout?: "centered" | "pills";
		/** A fixed highlight colour, instead of the map's colour scale. */
		accent?: string;
	};
};

/**
 * A history card: one area's latest value over a line of the periods before
 * it, read from the statistics of a measure. Drawn by the shared series card
 * so a dataset with a history needs no chart component of its own.
 */
export type DisplaySeries = {
	heading: string;
	/** Shown in brackets after the heading. */
	period: string;
	/** The source and method note shown as the card's tooltip. */
	source: string;
	/** The card's highlight colour. */
	accent: string;
	/** The line's colour; the accent when absent. */
	line?: string;
	/** The measure to draw for each of the dataset's measures, by id. */
	measures: Record<string, string>;
	/**
	 * For a measure that is a percentage rate, the measure of the people it
	 * counts, so the card can combine areas: rates cannot be averaged, but
	 * each area's count over its rate gives the base the rate is of. Without
	 * it a rate shows nothing until an area is chosen.
	 */
	countOf?: Record<string, string>;
	/**
	 * How the areas in scope combine before one is chosen. Absent, a measure
	 * that adds up is summed; `mean` takes each area's value once, for a
	 * measure such as a price that cannot be added up.
	 */
	combine?: "mean";
	/** A heading for each of the dataset's measures, by id, where it differs from `heading`. */
	headings?: Record<string, string>;
};

/**
 * A breakdown card: one area's total split into parts, read from the
 * statistics of a measure by the members of one of its dimensions. Drawn by
 * the shared breakdown chart so a dataset that splits a total needs no chart
 * component of its own.
 */
export type DisplayBreakdown = {
	heading: string;
	/** Shown in brackets after the heading. */
	period: string;
	/** The source and method note shown as the card's tooltip. */
	source: string;
	/** The nations the source covers. */
	coverage?: string;
	/** The measure whose rows are split. */
	measure: string;
	/** The slug of the dimension the total splits across. */
	dimension: string;
	/**
	 * The code of the member that is the total, the denominator of every
	 * share. Absent, the total is the sum of the parts.
	 */
	total?: string;
	/** The parts, in the order they are drawn. */
	parts: readonly {
		/** The member's code in the dimension. */
		code: string;
		color: string;
		/** Shorter wording than the member's own label, where the key is tight. */
		label?: string;
	}[];
	/** The code of the part whose colour highlights the card; absent, the largest. */
	accent?: string;
	/** Draw the largest part first, rather than in the declared order. */
	order?: "largest";
};

/**
 * A card of bars on one shared scale, one for each member of a dimension of a
 * measure, read from the statistics. Drawn by the shared bars chart, with
 * `component` set to `@/components/measures/MeasureBarsChart`. A dataset of
 * several editions, such as life expectancy and healthy life expectancy,
 * names the measure each edition's bars read; the first edition is shown first.
 */
export type DisplayBars = {
	heading: string;
	/** The measure to read for each edition of the dataset, by the edition's id. */
	measures: Record<string, string>;
	/** The map view each edition selects when the card is clicked, where it has one. */
	views?: Record<string, string>;
	/** The slug of the dimension whose members each get a bar. */
	dimension: string;
	/** The members drawn, in order, with the short label beside each bar. */
	bars: readonly { code: string; label: string }[];
	/** How areas combine before one is chosen: added up, or a plain mean. */
	combine: "sum" | "mean";
	/** Pale to deep, the colours a bar runs through from the scale's low to its high. */
	ramp: { low: string; high: string };
	/** Decimal places of each value. */
	digits: number;
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
	/** The chart's label in the data list. */
	label: string;
	/** The edition shown first. */
	year: number;
	/**
	 * The shared chart card. Absent when `component` draws the chart, which a
	 * dataset needs only when its chart is more than one headline value.
	 */
	card?: DisplayCard;
	/**
	 * The website module of a chart component of its own, such as
	 * `@/components/datasets/infrastructure/digital-connectivity/broadband/BroadbandChart`.
	 */
	component?: string;
	/**
	 * The history card, with `component` set to the shared series chart,
	 * `@/components/measures/MeasureSeriesChart`.
	 */
	series?: DisplaySeries;
	/**
	 * The breakdown card, with `component` set to the shared breakdown chart,
	 * `@/components/measures/MeasureBreakdownChart`.
	 */
	breakdown?: DisplayBreakdown;
	/** The bars card, with `component` set to the shared bars chart. */
	bars?: DisplayBars;
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
