export type GeometryContainmentValidation =
	| {
			status: "checked";
			sourceAreaCount: number;
			testedVertexCount: number;
			boundaryVertexCount: number;
			/** How far outside its parent a vertex may lie and still be within. */
			toleranceM: number;
			/** Vertices outside their parent, but within the tolerance of it. */
			toleratedVertexCount: number;
			/** Vertices beyond tolerance, grouped by source area at its furthest point. */
			outsideToleranceAreas: Array<{
				code: string;
				parent: string;
				outsideM: number;
			}>;
			/** Geometry inputs and correction definitions used by this check. */
			geometryInputs: GeometryContainmentInputs;
			/** The furthest any outside vertex lies beyond its parent. */
			widestOutsideM: number;
	  }
	| { status: "not-available"; reason: string };

export type GeometryContainmentInputs = Array<{
	side: "from" | "to";
	geography: string;
	boundaryRelease: string;
	input: string;
	inputHash: string | null;
	crs: string;
	codeProperty: string;
	corrections: Array<{ id: string; contentHash: string }>;
	/** Geometry substitutions, with the hash of the donor file they read. */
	substitutions?: Array<{ id: string; donorInputHash: string | null }>;
	/** Grid offsets undone on a WGS84 release, with their definition's hash. */
	reversedOffsets?: Array<{ id: string; contentHash: string }>;
}>;
