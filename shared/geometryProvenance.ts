import type { GeometryValidityReport } from "./geometryValidity";

export type GeometryTransformation = {
	name: string;
	epsg: string;
	/** EPSG's stated accuracy for the transformation within its area of use. */
	accuracyM: number;
	areaOfUse: string;
};

export type GeometryProvenance = {
	/** The source file, with its hash, when the registry records one. */
	input?: string;
	inputHash?: string;
	sourceCrs: string;
	validity?: GeometryValidityReport;
	transformation?: GeometryTransformation;
	/**
	 * Declared grid corrections that moved this area before reprojection, and
	 * geometry substitutions that replaced it with another release's area.
	 */
	corrections?: Array<{ id: string; description: string }>;
};
