import type { BoundaryType } from "./catalog";

/** Returns the first populated value among a boundary feature's known keys. */
export const getProp = (
	props: object,
	keys: readonly string[],
): string | undefined => {
	for (const key of keys) {
		const value = Reflect.get(props, key);
		if (typeof value === "string" && value) return value;
	}
	return undefined;
};

const ITL_COUNTRY_PREFIXES: Record<string, string> = {
	C: "E",
	D: "E",
	E: "E",
	F: "E",
	G: "E",
	H: "E",
	I: "E",
	J: "E",
	K: "E",
	L: "W",
	M: "S",
	N: "N",
};

export const countryPrefixForBoundaryCode = (
	type: BoundaryType,
	code: string,
): string | undefined => {
	if (type === "itl1" || type === "itl2" || type === "itl3")
		return ITL_COUNTRY_PREFIXES[code[2]];
	return code[0];
};
