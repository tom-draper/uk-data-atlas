import type { SourceGeography } from "./dataCatalog";

/**
 * Several measures' observations for one source partition and period, stored
 * once. A census table publishes every category for every area, so writing
 * each category as its own artifact would repeat every area code once per
 * category; a table keeps one row per area with a value per measure.
 */
export type MeasureTableArtifact = {
	schemaVersion: 1;
	kind: "measure-table";
	contentHash: string;
	/** The artifact's own name, which every measure it serves names. */
	id: string;
	datasetId: string;
	sourceGeography: SourceGeography;
	period: string;
	/** The measure each value column serves, in column order. */
	measures: string[];
	/** An area code, then one value per measure; null where none is published. */
	records: Array<[string, ...Array<number | null>]>;
};

export const isMeasureTable = (
	artifact: unknown,
): artifact is MeasureTableArtifact =>
	typeof artifact === "object" &&
	artifact !== null &&
	(artifact as { kind?: unknown }).kind === "measure-table";
