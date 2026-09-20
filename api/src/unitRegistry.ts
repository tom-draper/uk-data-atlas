import type {
	DataCatalog,
	Measure,
	PopulationObservation,
} from "./dataCatalog";

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

const definition = (
	code: string,
	scaleToCanonical = 1,
	per?: string,
): UnitDefinition => ({
	code,
	scaleToCanonical,
	...(per ? { per } : {}),
});

const countUnits = new Set([
	"1x1 km grid cells",
	"applications",
	"chargers",
	"children",
	"claimants aged 16 and over",
	"claimants aged 16 to 24",
	"clients",
	"dwellings",
	"enterprises",
	"households",
	"jobs",
	"offences",
	"people",
	"people in employment",
	"reported collisions",
	"unemployed residents aged 16 and over",
	"usual residents",
	"usual residents aged 16 and over",
	"votes",
]);

/**
 * The registry is deliberately exhaustive. A new display unit is an editorial
 * decision, not an opportunity for an API to guess whether `m`, `million`, or
 * `%` carries a scale or denominator.
 */
export const unitDefinitionFor = (unit: string): UnitDefinition => {
	if (countUnits.has(unit)) return definition("1");
	switch (unit) {
		case "percent":
		case "% of premises":
		case "% of economically active residents aged 16 and over":
			return definition(
				"proportion",
				0.01,
				unit === "% of premises"
					? "premises"
					: unit.startsWith("% of ")
						? unit.slice("% of ".length)
						: undefined,
			);
		case "GBP":
		case "£":
			return definition("GBP");
		case "£ thousand":
			return definition("GBP", 1_000);
		case "£ million":
			return definition("GBP", 1_000_000);
		case "£ per hour":
			return definition("GBP", 1, "hour");
		case "£ per year":
			return definition("GBP", 1, "year");
		case "GWh":
			return definition("GWh");
		case "kt CO2e":
			return definition("t[CO2e]", 1_000);
		case "tonnes":
			return definition("t");
		case "µg/m³":
			return definition("ug/m3");
		case "years":
			return definition("year");
		case "people per square kilometre":
			return definition("person", 1, "km2");
		case "score out of 24":
			return definition("score");
		case "party":
			return definition("category");
		default:
			if (unit.startsWith("rank of ")) return definition("rank");
			if (unit.startsWith("decile, where ")) return definition("decile");
			throw new Error(
				`No canonical unit definition is declared for display unit ${JSON.stringify(unit)}.`,
			);
	}
};

/** Adds API-owned unit semantics without rewriting a source artifact or value. */
export const withUnitDefinitions = (catalog: DataCatalog): DataCatalog => ({
	...catalog,
	measures: catalog.measures.map((measure) => ({
		...measure,
		unitDefinition: unitDefinitionFor(measure.unit),
	})),
});

/** Narrows a measure only after proving the display unit has a declared meaning. */
export const measureUnit = (measure: Measure): UnitDefinition =>
	measure.unitDefinition ?? unitDefinitionFor(measure.unit);

/** The explicit receipt returned when a caller asks to see canonical values. */
export type CanonicalValueRepresentation = {
	mode: "canonical";
	sourceUnit: string;
	unit: UnitDefinition;
	calculation: {
		method: "unit-normalisation";
		scaleToCanonical: number;
		note: string;
	};
};

/**
 * Describes an opt-in presentation calculation without changing a source
 * observation or claiming that a publisher supplied the canonical value.
 */
export const canonicalValueRepresentation = (
	measure: Measure,
): CanonicalValueRepresentation => {
	const unit = measureUnit(measure);
	return {
		mode: "canonical",
		sourceUnit: measure.unit,
		unit,
		calculation: {
			method: "unit-normalisation",
			scaleToCanonical: unit.scaleToCanonical,
			note: "Each numeric value and any publisher-supplied interval bound was multiplied by the declared scale. Source observations remain unchanged.",
		},
	};
};

/** Applies only the declared scale, preserving the source record object. */
export const normaliseObservation = <T extends PopulationObservation>(
	record: T,
	unit: UnitDefinition,
): T => ({
	...record,
	value: record.value * unit.scaleToCanonical,
	...(record.confidenceInterval
		? {
				confidenceInterval: {
					lower: record.confidenceInterval.lower * unit.scaleToCanonical,
					upper: record.confidenceInterval.upper * unit.scaleToCanonical,
				},
			}
		: {}),
});
