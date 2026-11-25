import { gazetteer } from "@/lib/data/gazetteer/static";
import type { SelectedArea } from "@/lib/types/areas";

/** A place in one nation, read through the councils it is made of. */
export type LocationCouncils = {
	/** The nation's code initial: `S` for Scotland, `N` for Northern Ireland. */
	initial: string;
	/** The place's current councils; one for a council or a city. */
	councils: readonly SelectedArea[];
};

/** A nation's own place, which lists no councils of its own. */
const NATION_INITIALS: Readonly<Record<string, string>> = {
	Scotland: "S",
	"Northern Ireland": "N",
};

let current: Set<string> | undefined;
const currentCouncils = () =>
	(current ??= new Set(gazetteer.currentCouncilCodes()));

/**
 * The current councils of a place in Scotland or Northern Ireland, as areas
 * a nation's figures can be read for. A place lists every council code it has
 * had, such as Glasgow's before and after 2018, so only the current ones are
 * kept: reading both would count the city twice. Null for a place in England
 * or Wales, one spanning nations, or one with no current council.
 */
export function locationCouncils(
	location: string | null | undefined,
): LocationCouncils | null {
	if (!location) return null;
	const nation = NATION_INITIALS[location];
	const codes = nation
		? [...currentCouncils()].filter((code) => code.startsWith(nation))
		: gazetteer
				.membersOf(location)
				.filter((code) => currentCouncils().has(code));
	const initial = codes[0]?.charAt(0);
	if (
		!initial ||
		!(initial === "S" || initial === "N") ||
		codes.some((code) => !code.startsWith(initial))
	)
		return null;
	return {
		initial,
		councils: codes.map((code) => {
			const entry = gazetteer.get(code);
			return {
				type: "localAuthority",
				code,
				name: entry?.name ?? code,
				data: null,
				boundaryYear: entry?.vintage,
			};
		}),
	};
}
