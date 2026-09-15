import { describe, expect, it } from "vitest";
import { loadCrime } from "@/lib/data/crime/loader";

const counts = (total: number) =>
	[total, ...Array.from({ length: 22 }, () => 1)].join(",");

// The shape of Table C2: a title, notes, a header, then force totals, rows
// per partnership, and crimes unassigned to any partnership.
const csv = `"Table C2: Number of police recorded crimes by Community Safety Partnership area, England and Wales, year ending June 2025",,
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
`;

const read = async () => csv;

describe("loadCrime", () => {
	it("keeps every partnership, including those covering several authorities", async () => {
		const [dataset] = Object.values(await loadCrime(read));

		expect(Object.keys(dataset.partnerships).sort()).toEqual([
			"E22000063",
			"E22000064",
			"E22000100",
			"E22000274",
			"E22000278",
			"E22000362",
			"E22000363",
		]);
		expect(dataset.partnerships.E22000363).toMatchObject({
			communitySafetyPartnershipName: "North Devon",
			localAuthorityCode: null,
			totalRecordedCrime: 9618,
		});
	});

	it("gives an authority split between partnerships their sum", async () => {
		const [dataset] = Object.values(await loadCrime(read));

		expect(dataset.data.E06000058.totalRecordedCrime).toBe(15000);
		expect(dataset.data.E06000058.ladName).toBe(
			"Bournemouth, Christchurch and Poole",
		);
		expect(dataset.data.E06000058.homicide).toBe(2);
		expect(
			dataset.data.E06000058.communitySafetyPartnershipCode,
		).toBeUndefined();
		expect(dataset.data.E06000026).toMatchObject({
			communitySafetyPartnershipCode: "E22000100",
			totalRecordedCrime: 20000,
		});
	});

	it("names a split authority only where its rows agree on the name", async () => {
		const [dataset] = Object.values(await loadCrime(read));

		expect(dataset.data.E07000244).toMatchObject({
			ladName: "",
			totalRecordedCrime: 12397,
		});
	});

	it("gives no authority value for a partnership covering several, and no placeholder key", async () => {
		const [dataset] = Object.values(await loadCrime(read));

		expect(Object.keys(dataset.data).sort()).toEqual([
			"E06000026",
			"E06000058",
			"E07000244",
		]);
	});

	it("refuses an unavailable count rather than reading it as none", async () => {
		const unavailable = csv.replace(
			`E06000026,Plymouth,${counts(20000)}`,
			`E06000026,Plymouth,[x],${counts(1).slice(2)}`,
		);
		await expect(loadCrime(async () => unavailable)).rejects.toThrow(
			/E22000100 totalRecordedCrime is not a count/,
		);
	});
});
