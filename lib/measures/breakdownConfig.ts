import type { BreakdownPart } from "./breakdown";

/**
 * A breakdown card as the website draws it: which measure to read, where,
 * how its total splits, and the words around it. Built from a dataset
 * declaration's `display.breakdown`.
 */
export interface BreakdownCardConfig {
	/** The measure, and the release it is read from. */
	request: {
		measure: string;
		datasetId: string;
		geography: string;
		boundaryYear: number;
	};
	/** The dimension whose members the total splits across. */
	dimension: string;
	/**
	 * The code of the member that is the total. Absent, the total is the sum
	 * of the parts, for a dimension with no member of its own for it.
	 */
	total?: string;
	/** The parts, in the order they are drawn. */
	parts: readonly BreakdownPart[];
	/** The part whose colour highlights the card; absent, the largest. */
	accent?: string;
	/** Draw the largest part first, rather than in the declared order. */
	order?: "largest";
	/** The legend filter that hides parts while this card's dataset is on the map. */
	legendFilter?: "ethnicity";
	heading: string;
	/** Shown in brackets after the heading. */
	period: string;
	/** The source and method note shown as the card's tooltip. */
	source: string;
	coverage?: string;
}
