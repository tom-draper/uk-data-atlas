import { createHash } from "node:crypto";

/**
 * How a typed name is reduced before it is matched against a compiled index.
 *
 * Every index keyed by a normalised name is built with these functions at
 * compile time and queried with them at request time. The two must agree
 * exactly, or a lookup silently misses, so a compiled index records the
 * `NAME_NORMALISATION` fingerprint it was built with and a loader refuses one
 * built under different rules.
 */

/**
 * A name reduced to what distinguishes it: case, accents, punctuation and the
 * ampersand all set aside, so "Brighton & Hove", "brighton and hove" and
 * "Ynys Môn" match what was published.
 */
export const normalisePlaceName = (value: string) =>
	value
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/['’]/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();

/**
 * The same name with an administrative title removed, or undefined when it
 * carries none. Publishers write "Bristol, City of" and "Kingston upon Hull,
 * City of"; nobody searches for either.
 */
export const withoutTitle = (normalised: string) => {
	const stripped = normalised
		.replace(/\b(city|county|borough|royal borough) of\b/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	return stripped && stripped !== normalised ? stripped : undefined;
};

/**
 * Names chosen to exercise every rule above. Changing a rule changes how at
 * least one of them normalises, and so changes the fingerprint.
 */
const PROBES = [
	"Brighton & Hove",
	"Ynys Môn",
	"King's Lynn",
	"King’s Lynn",
	"  Newcastle-upon-Tyne  ",
	"Bristol, City of",
	"Kingston upon Hull, City of",
	"County of Herefordshire",
	"Royal Borough of Greenwich",
	"Borough of Poole",
	"St. Helens",
	"Na h-Eileanan Siar",
	"Ards and North Down",
	"E08000003",
	"Ceredigion (Sir Ceredigion)",
];

/** A fingerprint of the rules as this build of the API applies them. */
export const NAME_NORMALISATION = `sha256:${createHash("sha256")
	.update(
		JSON.stringify(
			PROBES.map((probe) => {
				const normalised = normalisePlaceName(probe);
				return [normalised, withoutTitle(normalised) ?? null];
			}),
		),
	)
	.digest("hex")}`;
