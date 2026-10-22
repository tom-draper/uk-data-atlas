/**
 * The two fuels are published separately, as separate accredited official
 * statistics, so each is its own dataset with its own source block. They share
 * a publisher, a licence and a geography.
 */
const SHARED = {
	source: "Department for Energy Security and Net Zero",
	year: "2015-2024",
	licence: "Open Government Licence v3.0",
	licenceUrl:
		"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
} as const;

const description = (fuel: string, extra: string) =>
	`Metered ${fuel} consumption by local authority in Great Britain, 2015 to 2024, split between domestic and non-domestic meters and reported in GWh. ${extra} The series is restated on 2025 local authority codes; earlier published years are on the boundaries in force at the time and are not included.`;

export const ELECTRICITY_CONSUMPTION_SOURCE = {
	...SHARED,
	name: "Subnational electricity consumption",
	sourceUrl:
		"https://www.gov.uk/government/statistics/regional-and-local-authority-electricity-consumption-statistics",
	description: description(
		"electricity",
		"Domestic meters are counted on both standard and Economy 7 tariffs.",
	),
};

export const GAS_CONSUMPTION_SOURCE = {
	...SHARED,
	name: "Subnational gas consumption",
	sourceUrl:
		"https://www.gov.uk/government/statistics/regional-and-local-authority-gas-consumption-statistics",
	description: description(
		"gas",
		"Figures are weather corrected, as the publisher's headline series is, so a cold year is not read as a rise in demand.",
	),
};
