import { periods } from "../../declaration/statistics.ts";

/** The census 2021 tables describe the usual residents on census day. */
export const census2021 = () => periods.census(2021);

/**
 * The local-authority tables give 2021 districts, plus the unitaries that
 * replaced some of them in 2023, so codes are placed on whichever release
 * holds them.
 */
export const districts2021 = {
	release: () => ({ geography: "localAuthority", year: 2021 }),
	alsoIn: [{ geography: "localAuthority", year: 2023 }],
};

/** The licence terms of every census table. */
export const CENSUS_LICENCE = {
	licence: "Open Government Licence v3.0",
	licenceUrl:
		"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
	attribution:
		"Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0.",
} as const;
