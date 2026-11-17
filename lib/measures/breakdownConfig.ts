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
	/** The code of the member that is the total. */
	total: string;
	/** The parts, in the order they are drawn. */
	parts: readonly BreakdownPart[];
	/** The part whose colour highlights the card. */
	accent: string;
	heading: string;
	/** Shown in brackets after the heading. */
	period: string;
	/** The source and method note shown as the card's tooltip. */
	source: string;
	coverage?: string;
}
