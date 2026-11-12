import type { StatisticsParty } from "../../declaration/vocabulary.ts";
import type { DeclaredDimension } from "../../declaration/statistics.ts";
import { PARTIES, PARTY_INFO } from "./parties.ts";

/** The party dimension of the general and local election datasets. */
export const PARTY: DeclaredDimension = {
	slug: "party",
	label: "Party",
	members: PARTY_INFO.map(({ key, name }) => ({ key, label: name })),
};

/** The parties the atlas names, with the colour it draws each in. */
export const PARTY_REFERENCE: StatisticsParty[] = PARTY_INFO.map(
	({ key, name }) => ({
		key,
		name,
		colour: (PARTIES as Record<string, { color: string } | undefined>)[key]
			?.color,
	}),
);

/** A fresh copy of the party list for a payload header. */
export const partyInfoCopy = () => PARTY_INFO.map((party) => ({ ...party }));
