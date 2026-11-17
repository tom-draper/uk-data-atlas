/**
 * A card of bars on one shared scale, one bar for each member of a
 * dimension of a measure. Hand-declared on a chart definition until a
 * dataset declaration can carry it.
 */
export interface BarsCardConfig {
	/** The release the measures are read from. */
	request: {
		datasetId: string;
		geography: string;
		boundaryYear: number;
	};
	/**
	 * The measure to read for each id of the dataset a chart can show, as one
	 * chart may switch between several, such as life expectancy and healthy
	 * life expectancy.
	 */
	measures: Readonly<Record<string, string>>;
	/** The map view each dataset id selects when the card is clicked, where it has one. */
	views?: Readonly<Record<string, string>>;
	/** The dimension whose members each get a bar. */
	dimension: string;
	/** The members drawn, in order, with the short label beside each bar. */
	bars: ReadonlyArray<{ code: string; label: string }>;
	/** How areas combine before one is chosen: added up, or a plain mean. */
	combine: "sum" | "mean";
	/** Pale to deep, the colours a bar runs through from the scale's low to its high. */
	ramp: { low: string; high: string };
	/** Decimal places of each value. */
	digits: number;
	heading: string;
}
