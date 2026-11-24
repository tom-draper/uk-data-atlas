import { createHash } from "node:crypto";
import { normalisePlaceName, withoutTitle } from "@uk-data-atlas/geography";

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
