import type { Dataset, SelectedArea } from "@/lib/types";

/** The identity and wording of one national deprivation index. */
export interface DeprivationIndex {
	/** Dataset type as it appears on the active dataset, e.g. "imd". */
	datasetType: Dataset["type"];
	/** Short name shown in the heading, e.g. "IMD". */
	label: string;
	region: string;
	attribution: string;
	metric: DeprivationDetail["kind"];
	/** Highest value in this fixed index release, used to normalise its bar. */
	metricMaximum: number;
	/** What the index calls its small areas, e.g. "LSOAs". */
	areaNoun: string;
}

/** The one line of detail under the decile: a rank, or a deprivation score. */
export type DeprivationDetail =
	{ kind: "rank"; value: number } | { kind: "score"; value: number };

/** A national deprivation index's card, read from its dataset declaration. */
export interface DeprivationCardConfig extends DeprivationIndex {
	/** The index's own small-area geography, as a selected area's type. */
	areaType: SelectedArea["type"];
	/** The compiled dataset field holding each authority's summary. */
	summaryField: string;
	/** The record field behind the index's metric. */
	metricField: string;
	/** The record field holding the published decile, where there is one. */
	decileField?: string;
	/** The measure the card headlines; any other is a domain score. */
	headlineMeasure: string;
	/** Present when the measures after the headline are domain scores. */
	domains?: { attribution: string };
	/** Earlier editions, listed beneath the latest and never as a trend. */
	earlierEditions?: {
		/** The record field holding each small area's published rank. */
		rankField: string;
		/** Each earlier edition with how many small areas it ranks. */
		editions: { year: number; areaCount: number }[];
	};
}
