import type { Country } from "../dataCatalog";

/**
 * Northern Ireland's super output areas predate the GSS scheme and keep their
 * NISRA codes, such as 95AA01S1: two digits for the region, two letters for
 * the former district, then a ward and a split suffix.
 */
const NI_SUPER_OUTPUT_AREA_CODE = /^95[A-Z]{2}\d{2}[A-Z]\d$/;

export const isPublishedAreaCode = (code: string) =>
	/^[ENSW]\d{8}$/.test(code) || NI_SUPER_OUTPUT_AREA_CODE.test(code);

export const countryForCode = (code: string): Country => {
	if (NI_SUPER_OUTPUT_AREA_CODE.test(code)) return "GB-NIR";
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
