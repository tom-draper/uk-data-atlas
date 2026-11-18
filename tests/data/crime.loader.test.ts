import { describe, expect, it } from "vitest";
import {
	crimeStatisticsParts,
	type DirectRecord,
} from "@uk-data-atlas/datasets";

const counts = (total: number) =>
	[total, ...Array.from({ length: 22 }, () => 1)].join(",");

// The shape of Table C2: a title, notes, a header, then force totals, rows
// per partnership, and crimes unassigned to any partnership.
const csv = `"Table C2: Number of police recorded crimes by Community Safety Partnership area, England and Wales, year ending March 2026 [note 1]",,
Source: Police recorded crime from the Home Office,,
"Police Force
Area code","Police Force
Area name","Community Safety
Partnership code","Community Safety
Partnership name",Local Authority code,Local Authority name,Total recorded crime
E23000035,Devon and Cornwall,,,,,${counts(50000)}
E23000035,Devon and Cornwall,E22000362,East and Mid Devon,Combined Local Authorities,,${counts(10997)}
E23000035,Devon and Cornwall,E22000363,North Devon,Combined Local Authorities,,${counts(9618)}
E23000035,Devon and Cornwall,E22000100,Plymouth,E06000026,Plymouth,${counts(20000)}
E23000039,Dorset,E22000063,Bournemouth,E06000058,"Bournemouth, Christchurch and Poole",${counts(9000)}
E23000039,Dorset,E22000064,Poole,E06000058,"Bournemouth, Christchurch and Poole",${counts(6000)}
E23000025,Suffolk,E22000274,Suffolk Coastal,E07000244,Suffolk Coastal,${counts(5152)}
E23000025,Suffolk,E22000278,Waveney,E07000244,Waveney,${counts(7245)}
E23000035,Devon and Cornwall,,Unassigned Devon and Cornwall,,,${counts(300)}
E23000032,Kent [note 4],,,,,${counts(150000)}
E23000032,Kent,E22000137,Ashford,E07000105,Ashford,${counts(9197)}
E23000032,Kent [note 4],E22000143,Medway,E06000035,Medway,${counts(107)}
E23000032,Kent [note 4],,Unassigned Kent,,,${counts(68563)}
`;

// The CSP notes sheet: note 4 moves some partnerships' crime to "Unassigned".
const notes = `CSP notes,
Note number,Note text
1,Caution must be taken when interpreting small numbers of offences.
4,"Due to ongoing IT issues, crime data for Maidstone, Medway, Tonbridge and Malling, Dartford and Gravesham, and Tunbridge Wells are recorded under an unassigned CSP group from 2024 onwards."
`;

const readWith = (table: string) => async (_path: string, sheet: string) =>
	sheet === "Notes - CSP" ? notes : table;

const read = readWith(csv);

const readParts = async (reader = read) => {
	const [part] = await crimeStatisticsParts(reader);
	return {
		part: part!,
		authorities: part!.records,
		partnerships: part!.recordSets!.partnerships!,
	};
};
const offence = (record: DirectRecord | undefined, key: string) =>
	record?.values.find((value) => value.members?.offence === key)?.value;
const find = (records: DirectRecord[], code: string) =>
	records.find((record) => record.code === code);

describe("crimeStatisticsParts", () => {
	it("keeps every partnership, including those covering several authorities", async () => {
		const { partnerships } = await readParts();

		expect(partnerships.map((record) => record.code).sort()).toEqual([
			"E22000063",
			"E22000064",
			"E22000100",
			"E22000137",
			"E22000274",
			"E22000278",
			"E22000362",
			"E22000363",
		]);
		const north = find(partnerships, "E22000363");
		expect(north?.name).toBe("North Devon");
		expect(north?.parents?.localAuthorityCode).toBeNull();
		expect(offence(north, "totalRecordedCrime")).toBe(9618);
	});

	it("gives an authority split between partnerships their sum", async () => {
		const { authorities } = await readParts();
		const split = find(authorities, "E06000058");

		expect(offence(split, "totalRecordedCrime")).toBe(15000);
		expect(split?.name).toBe("Bournemouth, Christchurch and Poole");
		expect(offence(split, "homicide")).toBe(2);
		expect(split?.parents?.communitySafetyPartnershipCode).toBeUndefined();
		const single = find(authorities, "E06000026");
		expect(single?.parents?.communitySafetyPartnershipCode?.code).toBe(
			"E22000100",
		);
		expect(offence(single, "totalRecordedCrime")).toBe(20000);
	});

	it("labels the part with the year its title names", async () => {
		const { part } = await readParts();

		expect(part.key).toBe("2026");
	});

	it("refuses a table whose title names no period", async () => {
		await expect(
			crimeStatisticsParts(
				readWith(csv.replace("year ending March 2026", "last year")),
			),
		).rejects.toThrow(/names no period/);
	});

	it("names a split authority only where its rows agree on the name", async () => {
		const { authorities } = await readParts();
		const split = find(authorities, "E07000244");

		expect(split?.name).toBe("");
		expect(offence(split, "totalRecordedCrime")).toBe(12397);
	});

	it("gives no authority value for a partnership covering several, and no placeholder key", async () => {
		const { authorities } = await readParts();

		expect(authorities.map((record) => record.code).sort()).toEqual([
			"E06000026",
			"E06000058",
			"E07000105",
			"E07000244",
		]);
	});

	it("refuses an unavailable count rather than reading it as none", async () => {
		const unavailable = csv.replace(
			`E06000026,Plymouth,${counts(20000)}`,
			`E06000026,Plymouth,[x],${counts(1).slice(2)}`,
		);
		await expect(
			crimeStatisticsParts(readWith(unavailable)),
		).rejects.toThrow(/E22000100 totalRecordedCrime is not a count/);
	});

	it("withholds a partnership whose crime its force recorded as unassigned", async () => {
		const { authorities, partnerships } = await readParts();

		expect(find(partnerships, "E22000143")).toBeUndefined();
		expect(find(authorities, "E06000035")).toBeUndefined();
		const ashford = find(authorities, "E07000105");
		expect(ashford?.parents?.policeForceAreaCode?.name).toBe("Kent");
		expect(offence(ashford, "totalRecordedCrime")).toBe(9197);
	});
});
