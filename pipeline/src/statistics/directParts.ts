import type { DirectPart } from "@uk-data-atlas/datasets";

/** Access to the normalized rows of each direct dataset, by type. */
export type DirectParts = Pick<
	ReadonlyMap<string, readonly DirectPart[]>,
	"get" | "has"
>;
