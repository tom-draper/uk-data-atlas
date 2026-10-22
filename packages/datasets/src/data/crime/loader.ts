import {
	CrimeCounts,
	CrimeDataset,
	CrimeLADData,
	CrimePartnershipData,
} from "../../types/crime";
import { parseCsv, findHeaderLine } from "../../helpers/parseCsv";

/**
 * The twelve months a table covers, from its title, such as "year ending March
 * 2026". Refused if absent, so a new edition cannot be mislabelled with the
 * period of the one it replaced.
 */
const periodFromTitle = (title: string) => {
	const match = title.match(/year ending ([A-Z][a-z]+) (\d{4})/);
	if (!match) throw new Error(`Crime table title names no period: ${title}`);
	return {
		dataDate: `year ending ${match[1]} ${match[2]}`,
		year: Number(match[2]),
	};
};

/** The count columns, in table order from the seventh column. */
const COUNT_FIELDS: Array<keyof CrimeCounts> = [
	"totalRecordedCrime",
	"violenceAgainstPerson",
	"homicide",
	"deathSeriesInjuryUnlawfulDriving",
	"violenceWithInjury",
	"violenceWithoutInjury",
	"stalkingHarassment",
	"sexualOffences",
	"robbery",
	"theftOffences",
	"burglary",
	"residentialBurglary",
	"nonResidentialBurglary",
	"vehicleOffences",
	"theftFromPerson",
	"bicycleTheft",
	"shoplifting",
	"otherTheftOffences",
	"criminalDamageArson",
	"drugOffences",
	"possessionWeapons",
	"publicOrderOffences",
	"miscellaneousCrimes",
];

/** What the table writes in place of an authority code for a multi-authority partnership. */
const COMBINED_AUTHORITIES = "Combined Local Authorities";

const AREA_CODE = /^[EW]\d{8}$/;

/**
 * A count cell, refused unless it is a number. The table marks unavailable
 * figures as [x], and reading one as zero would pass for no crime.
 */
const count = (value: string | undefined, context: string): number => {
	const parsed = Number((value ?? "").replace(/,/g, "").trim());
	if (!value?.trim() || !Number.isFinite(parsed))
		throw new Error(`${context} is not a count: ${JSON.stringify(value)}`);
	return parsed;
};

/**
 * The numbers of the notes saying a partnership's crime is recorded under its
 * force's "Unassigned" row instead, as an IT fault has done for several Kent
 * partnerships since 2024. A row citing one publishes only a remnant of the
 * area's crime, so it is withheld rather than read as next to none.
 */
async function unassignedNotes(notesCsv: string): Promise<Set<string>> {
	const { data: rows } = await parseCsv<string[]>(notesCsv, {
		header: false,
	});
	const notes = new Set<string>();
	for (const [number, text] of rows as string[][])
		if (
			/^\d+$/.test(number?.trim() ?? "") &&
			/recorded under an unassigned/i.test(text ?? "")
		)
			notes.add(number!.trim());
	return notes;
}

const citedNotes = (cell: string) =>
	[...cell.matchAll(/\[note (\d+)\]/gi)].map((match) => match[1]!);

/**
 * Table C2 publishes recorded crime by community safety partnership, not by
 * local authority. Most partnerships are one authority, but some cover
 * several, marked "Combined Local Authorities", and some authorities are
 * split between several partnerships, as Buckinghamshire and BCP still are.
 *
 * So every partnership is kept, keyed by its own code. An authority gets a
 * value only where the table attributes all of its crime: from its single
 * partnership, or as the sum of its several, which is exact for counts. An
 * authority inside a multi-authority partnership has none, since a
 * partnership's count cannot be divided between its authorities. Rows with no
 * partnership code, the force totals and the crimes left unassigned to any
 * partnership, are not areas and are skipped.
 */
export async function loadCrime(
	read: (path: string, sheet: string) => Promise<string>,
): Promise<Record<string, CrimeDataset>> {
	const workbook = "economics/crime/pfatablesyemarch2026.xlsx";
	const csvText = await read(workbook, "Table C2");
	const unassigned = await unassignedNotes(
		await read(workbook, "Notes - CSP"),
	);
	const { dataDate, year } = periodFromTitle(csvText.split("\n")[0] ?? "");

	const headerLine = findHeaderLine(csvText, "police force area code");
	const { data: rows } = await parseCsv<string[]>(csvText, {
		header: false,
		skipLines: headerLine + 1,
	});

	const partnerships: Record<string, CrimePartnershipData> = {};
	const withheld: string[] = [];
	for (const row of rows as string[][]) {
		const partnershipCode = row[2]?.trim() ?? "";
		// Only rows for a force are data; the header's cells span several
		// lines, so it cannot be found and skipped by name.
		if (!AREA_CODE.test(row[0]?.trim() ?? "") || !partnershipCode) continue;
		if (partnerships[partnershipCode])
			throw new Error(
				`Crime table repeats partnership ${partnershipCode}`,
			);
		// The force name carries the notes, as "Kent [note 4]".
		if (citedNotes(row[1] ?? "").some((note) => unassigned.has(note))) {
			withheld.push(row[3]?.trim() || partnershipCode);
			continue;
		}
		const authorityCode = row[4]?.trim() ?? "";
		if (
			authorityCode !== COMBINED_AUTHORITIES &&
			!AREA_CODE.test(authorityCode)
		)
			throw new Error(
				`Crime partnership ${partnershipCode} has no recognisable authority code: ${JSON.stringify(authorityCode)}`,
			);
		const counts = Object.fromEntries(
			COUNT_FIELDS.map((field, index) => [
				field,
				count(row[6 + index], `${partnershipCode} ${field}`),
			]),
		) as unknown as CrimeCounts;
		const single = authorityCode !== COMBINED_AUTHORITIES;
		partnerships[partnershipCode] = {
			communitySafetyPartnershipCode: partnershipCode,
			communitySafetyPartnershipName: row[3]?.trim() ?? "",
			policeForceAreaCode: row[0].trim(),
			policeForceAreaName: (row[1] ?? "")
				.replace(/\s*\[note \d+\]/gi, "")
				.trim(),
			localAuthorityCode: single ? authorityCode : null,
			localAuthorityName: single ? (row[5]?.trim() ?? "") : null,
			...counts,
		};
	}

	const byAuthority = new Map<string, CrimePartnershipData[]>();
	for (const partnership of Object.values(partnerships)) {
		if (!partnership.localAuthorityCode) continue;
		const list = byAuthority.get(partnership.localAuthorityCode) ?? [];
		list.push(partnership);
		byAuthority.set(partnership.localAuthorityCode, list);
	}
	const records: Record<string, CrimeLADData> = {};
	for (const [authorityCode, members] of byAuthority) {
		const [first] = members;
		// Some rows name a split authority by its former district, as Suffolk
		// Coastal and Waveney both stand for East Suffolk; where the rows
		// disagree, none of their names is the authority's.
		const names = new Set(
			members.map((member) => member.localAuthorityName),
		);
		records[authorityCode] = {
			ladCode: authorityCode,
			ladName: names.size === 1 ? (first.localAuthorityName ?? "") : "",
			policeForceAreaCode: first.policeForceAreaCode,
			policeForceAreaName: first.policeForceAreaName,
			// A summed authority has no one partnership to name.
			...(members.length === 1
				? {
						communitySafetyPartnershipCode:
							first.communitySafetyPartnershipCode,
						communitySafetyPartnershipName:
							first.communitySafetyPartnershipName,
					}
				: {}),
			...(Object.fromEntries(
				COUNT_FIELDS.map((field) => [
					field,
					members.reduce((total, member) => total + member[field], 0),
				]),
			) as unknown as CrimeCounts),
		};
	}

	return {
		[year]: {
			id: `crime${year}`,
			year,
			type: "crime",
			boundaryType: "localAuthority",
			boundaryYear: year,
			dataDate,
			jurisdiction: "England and Wales",
			data: records,
			partnerships,
			metadata: {
				source: "Police recorded crime from the Home Office",
				notes: [
					"Police recorded crime statistics are published as official statistics, not accredited official statistics",
					"Published by community safety partnership. An authority split between several partnerships is their sum; an authority inside a partnership covering several authorities has no value of its own.",
					...(withheld.length > 0
						? [
								`No figures for ${withheld.join(", ")}: the police recorded their crime under the force's unassigned total, so the published counts are only a remnant.`,
							]
						: []),
				],
			},
		},
	};
}
