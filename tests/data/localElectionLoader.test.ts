import {
	parseLocalElectionCsv,
	reconcile2023Data,
} from "@/lib/data/election/local-election/load";
import type { ElectionSourceConfig } from "@/lib/data/election/local-election/config";

const referenceConfig: ElectionSourceConfig = {
	year: 2024,
	path: "reference.csv",
	isReference: true,
	fields: {
		code: "Ward code",
		name: "Ward name",
		ladName: "Local authority name",
		ladCode: "Local authority code",
		turnout: "Turnout (%)",
		electorate: "Electorate",
		totalVotes: "Total votes",
	},
};

const unmappedConfig: ElectionSourceConfig = {
	year: 2023,
	path: "unmapped.csv",
	isReference: false,
	fields: {
		code: "",
		name: "WARDNAME",
		ladName: "DISTRICTNAME",
		turnout: "TURNOUT",
		electorate: "ELECT",
		totalVotes: "Grand Total",
	},
};

describe("local election loader", () => {
	it("reconciles unmapped wards without mutating the parsed dataset", () => {
		const reference = parseLocalElectionCsv(
			`Ward code,Ward name,Local authority name,Local authority code,Turnout (%),Electorate,Total votes,LAB,CON
E05000001,Central,Example Council,E06000001,50%,1000,500,300,200`,
			referenceConfig,
		);
		const unmapped = parseLocalElectionCsv(
			`WARDNAME,DISTRICTNAME,TURNOUT,ELECT,Grand Total,LAB,CON
Central,Example Council,60%,1200,700,250,450
Unmatched,Example Council,55%,900,400,300,100`,
			unmappedConfig,
		);

		const reconciled = reconcile2023Data(unmapped, [reference]);

		expect(reconciled.results).toEqual({ E05000001: "CON" });
		expect(reconciled.data.E05000001).toMatchObject({
			wardCode: "E05000001",
			ladCode: "E05000001",
			wardName: "Central",
			partyVotes: { LAB: 250, CON: 450 },
		});
		expect(reconciled).not.toHaveProperty("_unmapped");

		expect(unmapped.data).toEqual({});
		expect(unmapped.results).toEqual({});
		expect(unmapped).toHaveProperty("_unmapped", [
			expect.objectContaining({ wardName: "Central" }),
			expect.objectContaining({ wardName: "Unmatched" }),
		]);
	});
});
