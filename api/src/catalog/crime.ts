import { readFileSync } from "node:fs";
import { type Indicator, publishIndicators } from "./indicators";
import type { CatalogManifest, CompiledMeasure } from "./manifest";

/**
 * Recorded crime, on the geography it is published for. Table C2 counts
 * crime by community safety partnership, and a partnership can cover
 * several authorities or share one with others, so the partnership is the
 * only unit every count belongs to. The compiled dataset's authority view
 * is not served: it has no value where a partnership spans authorities.
 */
export const compileCrime = (
	manifest: CatalogManifest,
	crimePath: string,
): CompiledMeasure[] => {
	const offence = (
		id: string,
		label: string,
		field: string,
		note: string | undefined,
	): Indicator => ({
		id,
		label,
		field,
		valueKind: "count",
		unit: "offences",
		aggregation: { kind: "extensive", operation: "sum", available: true },
		notes: note ? [note] : [],
	});
	const crimeEdition = Object.values(
		JSON.parse(readFileSync(crimePath, "utf8")) as Record<
			string,
			{ year?: unknown; dataDate?: unknown }
		>,
	);
	const crimeMonths = [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December",
	];
	// The period is read from the edition rather than written here, so a
	// refreshed table cannot be served under the months of the one before.
	const crimeEnding = /^year ending ([A-Z][a-z]+) (\d{4})$/.exec(
		String(crimeEdition[0]?.dataDate),
	);
	const crimeMonth = crimeMonths.indexOf(crimeEnding?.[1] ?? "") + 1;
	if (crimeEdition.length !== 1 || !crimeEnding || crimeMonth === 0)
		throw new Error(
			`${crimePath}: expected one edition naming the twelve months it covers`,
		);
	const crimeYear = Number(crimeEnding[2]);
	const crimePeriod = `year-ending-${crimeYear}-${String(crimeMonth).padStart(2, "0")}`;
	return publishIndicators(manifest, {
		datasetId: "crime",
		path: crimePath,
		boundaryYear: crimeYear,
		table: "partnerships",
		geography: "communitySafetyPartnership",
		partitionBoundaryYear: 2023,
		period: crimePeriod,
		coverageNote:
			"Published source records cover every community safety partnership in England and Wales.",
		notes: [
			`Offences recorded by the police in the twelve months to ${crimeEnding[1]} ${crimeYear}, by the community safety partnership where they were committed.`,
			"Partnership counts do not sum to force or national totals. Offences with no exact location are recorded as unassigned to any partnership, and some offences at airports are recorded only at force level; neither is served.",
			"A partnership's count can be negative, where a force transferred or cancelled offences recorded in an earlier period.",
			"Police recorded crime is published as official statistics, not accredited official statistics. It counts what is reported to and recorded by the police, so it moves with reporting and recording practice as well as with crime.",
		],
		indicators: [
			offence(
				"crime-total",
				"Total recorded crime, excluding fraud",
				"totalRecordedCrime",
				"Every police recorded crime except fraud and computer misuse, which are recorded nationally rather than by force.",
			),
			offence(
				"crime-violence-against-the-person",
				"Violence against the person",
				"violenceAgainstPerson",
				"Includes homicide, death or serious injury caused by illegal driving, violence with and without injury, and stalking and harassment.",
			),
			offence(
				"crime-homicide",
				"Homicide",
				"homicide",
				"A subset of violence against the person.",
			),
			offence(
				"crime-death-or-serious-injury-by-illegal-driving",
				"Death or serious injury caused by illegal driving",
				"deathSeriesInjuryUnlawfulDriving",
				"A subset of violence against the person.",
			),
			offence(
				"crime-violence-with-injury",
				"Violence with injury",
				"violenceWithInjury",
				"A subset of violence against the person.",
			),
			offence(
				"crime-violence-without-injury",
				"Violence without injury",
				"violenceWithoutInjury",
				"A subset of violence against the person.",
			),
			offence(
				"crime-stalking-and-harassment",
				"Stalking and harassment",
				"stalkingHarassment",
				"A subset of violence against the person.",
			),
			offence(
				"crime-sexual-offences",
				"Sexual offences",
				"sexualOffences",
				"Recorded sexual offences, including rape.",
			),
			offence(
				"crime-robbery",
				"Robbery",
				"robbery",
				"Theft with the use or threat of force.",
			),
			offence(
				"crime-theft-offences",
				"Theft offences",
				"theftOffences",
				"Includes burglary, vehicle offences, theft from the person, bicycle theft, shoplifting and all other theft.",
			),
			offence(
				"crime-burglary",
				"Burglary",
				"burglary",
				"A subset of theft offences, made up of residential and non-residential burglary.",
			),
			offence(
				"crime-residential-burglary",
				"Residential burglary",
				"residentialBurglary",
				"A subset of burglary.",
			),
			offence(
				"crime-non-residential-burglary",
				"Non-residential burglary",
				"nonResidentialBurglary",
				"A subset of burglary.",
			),
			offence(
				"crime-vehicle-offences",
				"Vehicle offences",
				"vehicleOffences",
				"A subset of theft offences.",
			),
			offence(
				"crime-theft-from-the-person",
				"Theft from the person",
				"theftFromPerson",
				"A subset of theft offences.",
			),
			offence(
				"crime-bicycle-theft",
				"Bicycle theft",
				"bicycleTheft",
				"A subset of theft offences.",
			),
			offence(
				"crime-shoplifting",
				"Shoplifting",
				"shoplifting",
				"A subset of theft offences.",
			),
			offence(
				"crime-other-theft",
				"All other theft offences",
				"otherTheftOffences",
				"A subset of theft offences.",
			),
			offence(
				"crime-criminal-damage-and-arson",
				"Criminal damage and arson",
				"criminalDamageArson",
				undefined,
			),
			offence(
				"crime-drug-offences",
				"Drug offences",
				"drugOffences",
				"Drug offences are largely found through police activity, so their count reflects enforcement as much as prevalence.",
			),
			offence(
				"crime-possession-of-weapons",
				"Possession of weapons offences",
				"possessionWeapons",
				undefined,
			),
			offence(
				"crime-public-order-offences",
				"Public order offences",
				"publicOrderOffences",
				undefined,
			),
			offence(
				"crime-miscellaneous-crimes-against-society",
				"Miscellaneous crimes against society",
				"miscellaneousCrimes",
				undefined,
			),
		],
	});
};
