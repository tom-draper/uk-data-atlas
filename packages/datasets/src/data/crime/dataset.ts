import type { CrimeDataset } from "../../types/crime.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { measure } from "../../declaration/measures.ts";
import { periods } from "../../declaration/statistics.ts";
import { aggregateCrime } from "./aggregate.ts";
import { loadCrime } from "./loader.ts";

const offence = (
	key: string,
	code: string,
	label: string,
	parent?: string,
) => ({ key, code, label, ...(parent ? { parent } : {}) });

export const crime = defineDataset<CrimeDataset>({
	id: "crime",
	topic: "crime-and-justice",
	boundary: { type: "localAuthority", year: 2026 },
	coverageCountries: ["GB-ENG", "GB-WLS"],
	publishMapValues: true,
	source: {
		name: "Crime",
		publisher: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/peoplepopulationandcommunity/crimeandjustice/datasets/policeforceareadatatables",
		year: "2026",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Police recorded crime by local authority district for England and Wales.",
		cadence: "annual",
		notes: [],
	},
	// Table C2 is recorded crime by community safety partnership area, read
	// straight out of the published workbook rather than from an extract,
	// with the notes that say which areas' figures are incomplete.
	load: ({ xlsxSheet }) => loadCrime(xlsxSheet),
	statistics: {
		name: {
			data: "ladName",
			partnerships: "communitySafetyPartnershipName",
		},
		/** The local authorities, then the community safety partnerships they sit in. */
		records: [
			{
				from: "data",
				alsoIn: [{ geography: "localAuthority", year: 2022 }],
			},
			{
				from: "partnerships",
				release: () => ({
					geography: "communitySafetyPartnership",
					year: 2023,
				}),
			},
		],
		parents: [
			{
				sets: ["data", "partnerships"],
				code: "policeForceAreaCode",
				name: "policeForceAreaName",
				release: { geography: "policeForceArea", year: 2023 },
			},
			{
				code: "communitySafetyPartnershipCode",
				name: "communitySafetyPartnershipName",
				release: {
					geography: "communitySafetyPartnership",
					year: 2023,
				},
			},
			/** A partnership that is one authority names it; one of several names none. */
			{
				sets: ["partnerships"],
				relation: "coterminous",
				nullable: true,
				code: "localAuthorityCode",
				release: { geography: "localAuthority", year: 2026 },
				alsoIn: [{ geography: "localAuthority", year: 2022 }],
			},
		],
		payload: {
			parts: () => [
				{
					key: "2026",
					header: {
						id: "crime2026",
						year: 2026,
						type: "crime",
						boundaryType: "localAuthority",
						boundaryYear: 2026,
						dataDate: "year ending March 2026",
						jurisdiction: "England and Wales",
						metadata: {
							source: "Police recorded crime from the Home Office",
							notes: [
								"Police recorded crime statistics are published as official statistics, not accredited official statistics",
								"Published by community safety partnership. An authority split between several partnerships is their sum; an authority inside a partnership covering several authorities has no value of its own.",
								"No figures for Dartford and Gravesham, Maidstone, Medway, Tonbridge and Malling, Tunbridge Wells: the police recorded their crime under the force's unassigned total, so the published counts are only a remnant.",
							],
						},
						coverageCountries: ["GB-ENG", "GB-WLS"],
					},
				},
			],
			code: {
				data: "ladCode",
				partnerships: "communitySafetyPartnershipCode",
			},
			/** A partnership that is one authority takes that authority's name, where it has one. */
			fill: (record, _code, earlier) => {
				if (!("localAuthorityCode" in record)) return;
				const authority = record.localAuthorityCode
					? (earlier.data as Record<string, { ladName?: string }>)[
							String(record.localAuthorityCode)
						]?.ladName
					: undefined;
				record.localAuthorityName = record.localAuthorityCode
					? authority || record.communitySafetyPartnershipName
					: null;
			},
		},
		period: () => periods.yearEnding(2026, 3),
		measures: [
			measure(
				"recorded-crimes",
				"Police recorded crime",
				"offences",
				"count",
				"sum",
				"Offences recorded by the police.",
			),
		],
		dimensions: [
			{
				slug: "offence",
				label: "Offence group",
				members: [
					offence(
						"totalRecordedCrime",
						"total",
						"All recorded crime",
					),
					offence(
						"violenceAgainstPerson",
						"violence-against-the-person",
						"Violence against the person",
						"totalRecordedCrime",
					),
					offence(
						"homicide",
						"homicide",
						"Homicide",
						"violenceAgainstPerson",
					),
					offence(
						"deathSeriesInjuryUnlawfulDriving",
						"death-or-serious-injury-by-unlawful-driving",
						"Death or serious injury caused by unlawful driving",
						"violenceAgainstPerson",
					),
					offence(
						"violenceWithInjury",
						"violence-with-injury",
						"Violence with injury",
						"violenceAgainstPerson",
					),
					offence(
						"violenceWithoutInjury",
						"violence-without-injury",
						"Violence without injury",
						"violenceAgainstPerson",
					),
					offence(
						"stalkingHarassment",
						"stalking-and-harassment",
						"Stalking and harassment",
						"violenceAgainstPerson",
					),
					offence(
						"sexualOffences",
						"sexual-offences",
						"Sexual offences",
						"totalRecordedCrime",
					),
					offence(
						"robbery",
						"robbery",
						"Robbery",
						"totalRecordedCrime",
					),
					offence(
						"theftOffences",
						"theft",
						"Theft offences",
						"totalRecordedCrime",
					),
					offence(
						"burglary",
						"burglary",
						"Burglary",
						"theftOffences",
					),
					offence(
						"residentialBurglary",
						"residential-burglary",
						"Residential burglary",
						"burglary",
					),
					offence(
						"nonResidentialBurglary",
						"non-residential-burglary",
						"Non-residential burglary",
						"burglary",
					),
					offence(
						"vehicleOffences",
						"vehicle-offences",
						"Vehicle offences",
						"theftOffences",
					),
					offence(
						"theftFromPerson",
						"theft-from-the-person",
						"Theft from the person",
						"theftOffences",
					),
					offence(
						"bicycleTheft",
						"bicycle-theft",
						"Bicycle theft",
						"theftOffences",
					),
					offence(
						"shoplifting",
						"shoplifting",
						"Shoplifting",
						"theftOffences",
					),
					offence(
						"otherTheftOffences",
						"other-theft",
						"All other theft offences",
						"theftOffences",
					),
					offence(
						"criminalDamageArson",
						"criminal-damage-and-arson",
						"Criminal damage and arson",
						"totalRecordedCrime",
					),
					offence(
						"drugOffences",
						"drug-offences",
						"Drug offences",
						"totalRecordedCrime",
					),
					offence(
						"possessionWeapons",
						"possession-of-weapons",
						"Possession of weapons offences",
						"totalRecordedCrime",
					),
					offence(
						"publicOrderOffences",
						"public-order-offences",
						"Public order offences",
						"totalRecordedCrime",
					),
					offence(
						"miscellaneousCrimes",
						"miscellaneous-crimes-against-society",
						"Miscellaneous crimes against society",
						"totalRecordedCrime",
					),
				],
			},
		],
		fields: [{ path: "{offence}", measure: "recorded-crimes" }],
	},
	display: {
		group: "Economics",
		label: "Crime Rate [2026]",
		defaultVisible: true,
		year: 2026,
		card: {
			heading: "Recorded Crime",
			coverage: "England & Wales",
			source: "Home Office. Police Recorded Crime Open Data Tables. data.police.uk",
		},
		measures: [
			{
				id: "total",
				label: "Total",
				field: "totalRecordedCrime",
				colorRange: { min: 10000, max: 100000 },
				legend: {
					min: 0,
					max: 150000,
					format: { kind: "count", suffix: " offences" },
				},
				// A total above 100,000 offences fills the bar; lower totals stay
				// proportional so small authorities are not flattened to zero.
				// A zero total means the table did not attribute the authority.
				card: {
					unit: "offences",
					maximum: 100_000,
					zeroIsMissing: true,
				},
			},
		],
		aggregation: { scope: "localAuthority", aggregate: aggregateCrime },
	},
});
