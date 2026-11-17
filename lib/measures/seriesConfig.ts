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
	};
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
