import {
	loadLocalElection,
	parseLocalElectionTable,
	reconcile2023Data,
} from "@/lib/data/election/local-election/load";
import type { ElectionSourceConfig } from "@/lib/data/election/local-election/config";

const referenceConfig: ElectionSourceConfig = {
	year: 2024,
	path: "reference.csv",
	sheet: "Sheet1",
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
	sheet: "Sheet1",
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
		const reference = parseLocalElectionTable(
			`Ward code,Ward name,Local authority name,Local authority code,Turnout (%),Electorate,Total votes,LAB,CON
E05000001,Central,Example Council,E06000001,50%,1000,500,300,200`,
			referenceConfig,
		);
		const unmapped = parseLocalElectionTable(
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

	it("reads every configured worksheet through the preprocessor reader", async () => {
		const tables: Record<string, string> = {
			"elections/local-elections/2025/LEH-2025-results-HoC.xlsx#Ward results":
				"ONS ward code,Ward/ County Electoral District name,Lower tier authority,Valid vote turnout (HoC method),Electorate,Ballots,LAB\nE05000001,Central,Example Council,50,1000,500,300",
			"elections/local-elections/2024/LEH-2024-results-HoC-version.xlsx#Wards results":
				"Ward code,Ward name,Local authority name,Local authority code,Turnout (%),Electorate,Total votes,LAB\nE05000001,Central,Example Council,E06000001,50,1000,500,300",
			"elections/local-elections/2023-candidates/LEH-Candidates-2023.xlsx#Ward_Level":
				"WARDNAME,DISTRICTNAME,TURNOUT,ELECT,Grand Total,LAB\nCentral,Example Council,50,1000,500,300",
			"elections/local-elections/2022/local-elections-2022.xlsx#Wards-results":
				"Ward code,Ward name,Local authority name,Local authority code,Turnout (%),Electorate,Total votes,LAB\nE05000001,Central,Example Council,E06000001,50,1000,500,300",
			"elections/local-elections/2021/local_elections_2021_results-2.xlsx#Wards-results":
				"Ward/ED code,Ward/ED name,Local authority name,Local authority code,Turnout (%),Electorate,Total votes,LAB\nE05000001,Central,Example Council,E06000001,50,1000,500,300",
		};
		const readSheet = async (path: string, sheet: string) => {
			const table = tables[`${path}#${sheet}`];
			if (!table) throw new Error(`unexpected worksheet: ${path}#${sheet}`);
			return table;
		};

		const datasets = await loadLocalElection(readSheet);

		expect(Object.keys(datasets).sort()).toEqual([
			"2021",
			"2022",
			"2023",
			"2024",
			"2025",
		]);
		expect(datasets[2023].data.E05000001).toMatchObject({
			wardName: "Central",
			partyVotes: { LAB: 300 },
		});
	});
});
