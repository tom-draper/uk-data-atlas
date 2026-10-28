/**
 * Northern Ireland postcodes come from Land and Property Services, whose
 * licence allows internal business use only. A public API cannot serve them.
 */
export const NORTHERN_IRELAND_EXCLUSION =
	"Northern Ireland postcodes are licensed by Land and Property Services for internal business use only, so this API does not serve them.";

const UNIT =
	/^(?:[A-Z]{1,2}[0-9][0-9A-Z]?[0-9][A-Z]{2}|GIR0AA|NPT[0-9][A-Z]{2})$/;
const DISTRICT = /^[A-Z]{1,2}[0-9][0-9A-Z]?$/;
const SECTOR = /^[A-Z]{1,2}[0-9][0-9A-Z]?[0-9]$/;

export type ParsedPostcode =
	| {
			kind: "unit";
			compact: string;
			display: string;
			/** The letters a postcode begins with, such as SW. */
			area: string;
			/** The outward code, such as SW1A. */
			district: string;
	  }
	| { kind: "district" | "sector"; display: string };

/**
 * Read a postcode however it was typed: any case, with or without its space.
 * A district ("M1") or sector ("M1 1") is recognised as such, so a caller can
 * be told a unit postcode is needed rather than that it does not exist.
 */
export const parsePostcode = (input: string): ParsedPostcode | undefined => {
	const compact = input.toUpperCase().replace(/\s+/g, "");
	if (UNIT.test(compact))
		return {
			kind: "unit",
			compact,
			display: `${compact.slice(0, -3)} ${compact.slice(-3)}`,
			area: /^[A-Z]+/.exec(compact)![0],
			district: compact.slice(0, -3),
		};
	if (DISTRICT.test(compact)) return { kind: "district", display: compact };
	if (SECTOR.test(compact))
		return {
			kind: "sector",
			display: `${compact.slice(0, -1)} ${compact.slice(-1)}`,
		};
	return undefined;
};

/** A unit postcode as the index keys it, "SW1A 1AA" as "SW1A1AA". */
export const compactPostcode = (postcode: string) =>
	postcode.replace(/\s+/g, "").toUpperCase();

export type QualityIndicator = {
	indicator: number;
	description: string;
	/**
	 * How far the centroid may lie from where the directory means it to be,
	 * in metres, when the directory says. Null where it does not.
	 */
	accuracyM: number | null;
};

// The directory's own descriptions of each positional quality indicator.
export const QUALITY: Record<string, Omit<QualityIndicator, "indicator">> = {
	"1": {
		description:
			"Within the building of the matched address closest to the postcode mean.",
		accuracyM: 0.5,
	},
	"2": {
		description:
			"Within the building of the matched address closest to the postcode mean, placed by visual inspection of Landline maps.",
		accuracyM: 0.5,
	},
	"3": { description: "Approximate to within 50 metres.", accuracyM: 50 },
	"4": {
		description:
			"The mean of the postcode's matched addresses, not snapped to a building.",
		accuracyM: 0.5,
	},
	"5": {
		description:
			"Imputed by ONS by reference to surrounding postcodes' grid references.",
		accuracyM: null,
	},
	"6": {
		description: "The mean of the postcode sector, mainly for PO Boxes.",
		accuracyM: null,
	},
	// England and Wales grid references from before November 2000 are to
	// 100 metres, the rest of the UK's to 10: the error is half a cell's
	// diagonal.
	"8": {
		description:
			"Terminated before November 2000; the last grid reference ONS knew.",
		accuracyM: null,
	},
	"9": { description: "No grid reference is available.", accuracyM: null },
};

/** The GSS codes the directory gives the countries it covers. */
export const COUNTRY_CODES: Record<string, string> = {
	E: "E92000001",
	W: "W92000004",
	S: "S92000003",
	N: "N92000002",
	L: "L93000001",
	M: "M83000003",
};
