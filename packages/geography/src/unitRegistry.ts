/**
 * Machine-readable unit semantics for a measure's published numeric values.
 *
 * `Measure.unit` remains the source-facing label that a person sees. This
 * definition says how those unchanged numbers relate to one canonical unit,
 * so a future derived calculation can reject incompatible inputs rather than
 * infer a conversion from prose.
 */
export type UnitDefinition = {
	/** Stable canonical unit identifier, independent of the display label. */
	code: string;
	/** Multiply a published value by this factor to reach `code`. */
	scaleToCanonical: number;
	/** The denominator where the measure is explicitly "per" something. */
	per?: string;
};
