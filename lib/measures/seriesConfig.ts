/**
 * A history card as the website draws it: which measure to read, where, and
 * the words around it. Built from a dataset declaration's `display.series`.
 */
export interface SeriesCardConfig {
	/** The measure, and the release it is read from. */
	request: {
		measure: string;
		datasetId: string;
		geography: string;
		boundaryYear: number;
		/** The member of each dimension to read, where not the default. */
		dimensions?: Record<string, string[]>;
	};
	/**
	 * The measure of the people a rate counts, which lets the card combine
	 * areas by their implied base. Absent for a measure that adds up, or one
	 * that cannot be combined.
	 */
	countMeasure?: string;
	/** The member of each dimension of `countMeasure` to read, where not the default. */
	countDimensions?: Record<string, string[]>;
	/** How areas combine before one is chosen; added up where absent. */
	combine?: "mean";
	heading: string;
	/** Shown in brackets after the heading. */
	period: string;
	/** The source and method note shown as the card's tooltip. */
	source: string;
	coverage?: string;
	accent: string;
	/** The line's colour. */
	line: string;
}
