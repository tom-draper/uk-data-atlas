import type { Country } from "../dataCatalog";

/**
 * Northern Ireland's super output areas predate the GSS scheme and keep their
 * NISRA codes, such as 95AA01S1: two digits for the region, two letters for
 * the former district, then a ward and a split suffix.
 */
const NI_SUPER_OUTPUT_AREA_CODE = /^95[A-Z]{2}\d{2}[A-Z]\d$/;

/**
 * International Territorial Level codes are not GSS codes: a letter for the
 * ITL1 area, then a character per tier below it, so TLC is the North East,
 * TLC3 Tees Valley and TLC31 Hartlepool and Stockton-on-Tees. The letter runs
 * C to N, C to K being the nine English regions. The last character may be a
 * letter rather than a digit: Northern Ireland has more ITL3 areas than the
 * digits allow, so its eleven run TLN01 to TLN04 and then TLN0A to TLN0G.
 */
const ITL_CODE = /^TL[C-N](\d[0-9A-Z]?)?$/;

/** The country each ITL1 letter belongs to, which the scheme fixes. */
const ITL_COUNTRY = {
	L: "GB-WLS",
	M: "GB-SCT",
	N: "GB-NIR",
} as const;

export const isPublishedAreaCode = (code: string) =>
	/^[ENSW]\d{8}$/.test(code) ||
	NI_SUPER_OUTPUT_AREA_CODE.test(code) ||
	ITL_CODE.test(code);

export const countryForCode = (code: string): Country => {
	if (NI_SUPER_OUTPUT_AREA_CODE.test(code)) return "GB-NIR";
	// An ITL area lies in exactly one country, named by its ITL1 letter; the
	// English regions take every letter the three others do not.
	if (ITL_CODE.test(code))
		return ITL_COUNTRY[code[2] as keyof typeof ITL_COUNTRY] ?? "GB-ENG";
	const country = (
		{
			E: "GB-ENG",
			N: "GB-NIR",
			S: "GB-SCT",
			W: "GB-WLS",
		} as const
	)[code[0] as "E" | "N" | "S" | "W"];
	if (!country) throw new Error(`Unsupported country prefix in ${code}`);
	return country;
};

export const countriesFor = (records: Array<{ areaCode: string }>): Country[] =>
	[
		...new Set(records.map((record) => countryForCode(record.areaCode))),
	].sort() as Country[];
