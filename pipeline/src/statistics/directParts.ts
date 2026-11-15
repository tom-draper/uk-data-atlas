import type { DirectPart } from "@uk-data-atlas/datasets";

/** The rows of each dataset read straight from its sources, by type. */
export type DirectParts = ReadonlyMap<string, readonly DirectPart[]>;
