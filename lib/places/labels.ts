import {
	PLACE_GEOGRAPHIES,
	releaseLabel,
	type AreaRef,
	type NamedRef,
} from "@/lib/places/profile";

const GEOGRAPHY_NAMES: Record<string, [singular: string, plural: string]> = {
	ward: ["Ward", "Wards"],
	localAuthority: ["Local authority", "Local authorities"],
	constituency: ["Westminster constituency", "Westminster constituencies"],
	lsoa: ["LSOA", "LSOAs"],
	msoa: ["MSOA", "MSOAs"],
	outputArea: ["Output area", "Output areas"],
	parish: ["Parish", "Parishes"],
	dataZone: ["Data zone", "Data zones"],
	intermediateZone: ["Intermediate zone", "Intermediate zones"],
	countyAndUnitaryAuthority: [
		"County or unitary authority",
		"Counties and unitary authorities",
	],
	countyElectoralDivision: [
		"County electoral division",
		"County electoral divisions",
	],
	region: ["Region", "Regions"],
	country: ["Country", "Countries"],
};

/** A geography's name inside a sentence: lower case, except an acronym. */
export const geographyNoun = (geography: string, plural = false) => {
	const name = geographyName(geography, plural);
	// Acronyms and proper nouns keep their capitals.
	return /^([A-Z]{2,}|Westminster)/.test(name) ? name : name.toLowerCase();
};

/** "Ward", or "wards" with `plural`. */
export function geographyName(geography: string, plural = false) {
	const names = GEOGRAPHY_NAMES[geography];
	if (!names) return geography.replace(/([A-Z])/g, " $1").toLowerCase();
	return names[plural ? 1 : 0];
}

const KIND_NAMES: Record<string, [singular: string, plural: string]> = {
	country: ["Country", "Countries"],
	region: ["Region", "Regions"],
	county: ["County", "Counties"],
	"combined-authority": ["Combined authority", "Combined authorities"],
	"ceremonial-county": ["Ceremonial county", "Ceremonial counties"],
	"historic-county": ["Historic county", "Historic counties"],
	"editorial-grouping": ["Grouping of councils", "Groupings of councils"],
};

/** A named place's kind, as a reader would put it. */
export const namedKindName = (kind: string, plural = false) =>
	KIND_NAMES[kind]?.[plural ? 1 : 0] ?? kind.replace(/-/g, " ");

/** What any index row's kind means: a geography or a named place's kind. */
export const placeKindName = (kind: string) =>
	(PLACE_GEOGRAPHIES as readonly string[]).includes(kind)
		? geographyName(kind)
		: namedKindName(kind);

const COUNTRY_NAMES: Record<string, string> = {
	E: "England",
	W: "Wales",
	S: "Scotland",
	N: "Northern Ireland",
};

/** The nation an area code belongs to, from its first letter. */
export const countryOf = (code: string) => COUNTRY_NAMES[code[0] ?? ""];

/** The page for an area, when its geography has profiles. */
export const areaHref = (area: Pick<AreaRef, "geography" | "code">) =>
	(PLACE_GEOGRAPHIES as readonly string[]).includes(area.geography)
		? `/places/${area.code}`
		: undefined;

export const namedHref = (place: Pick<NamedRef, "id">) => `/places/${place.id}`;

/** `2023-04-01` → `April 2023`; a release id's leading date reads the same. */
export const dateLabel = releaseLabel;

/** "A", "A and B", "A, B and C". */
export function listNames(names: string[]) {
	if (names.length <= 1) return names.join("");
	return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
