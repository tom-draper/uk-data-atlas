import {
	loadLocalElection,
	parseLeapLocalElection,
	parseLocalElectionTable,
	reconcile2023Data,
} from "@/lib/data/election/local-election/load";
import type {
	ElectionSourceConfig,
	ElectionTableSourceConfig,
	LeapElectionSourceConfig,
} from "@/lib/data/election/local-election/config";

const referenceConfig: ElectionTableSourceConfig = {
	year: 2024,
	source: "xlsx",
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

const unmappedConfig: ElectionTableSourceConfig = {
	year: 2023,
	source: "xlsx",
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

	it("aggregates LEAP candidate rows and excludes Scottish STV records", () => {
		const config: LeapElectionSourceConfig = {
			year: 2019,
			source: "leap",
			path: "leap.zip",
		};
		const dataset = parseLeapLocalElection(
			`"Example Council","E06000001","Central","E05000001","Alex Example","Lab","320","1"
"Example Council","E06000001","Central","E05000001","Sam Example","C","280","0"
"Example Council","E06000001","Uncontested","E05000002","Alex Example","Lab","0","1"
"Scottish Council","S12000001","North","S13000001","Casey Example","SNP","400","1"`,
			config,
		);

		expect(dataset.results).toEqual({
			E05000001: "LAB",
			E05000002: "LAB",
		});
		expect(dataset.data.E05000001).toMatchObject({
			totalVotes: 600,
			turnoutPercent: 0,
			electorate: 0,
			partyVotes: { LAB: 320, CON: 280 },
		});
	});

	it("reads every configured worksheet through the preprocessor reader", async () => {
		const tables: Record<string, string> = {
			"politics/elections/local-elections/2025/LEH-2025-results-HoC.xlsx#Ward results":
				"ONS ward code,Ward/ County Electoral District name,Lower tier authority,Valid vote turnout (HoC method),Electorate,Ballots,LAB\nE05000001,Central,Example Council,50,1000,500,300",
			"politics/elections/local-elections/2024/LEH-2024-results-HoC-version.xlsx#Wards results":
				"Ward code,Ward name,Local authority name,Local authority code,Turnout (%),Electorate,Total votes,LAB\nE05000001,Central,Example Council,E06000001,50,1000,500,300",
			"politics/elections/local-elections/2023/LEH-Candidates-2023.xlsx#Ward_Level":
				"WARDNAME,DISTRICTNAME,TURNOUT,ELECT,Grand Total,LAB\nCentral,Example Council,50,1000,500,300",
			"politics/elections/local-elections/2022/local-elections-2022.xlsx#Wards-results":
				"Ward code,Ward name,Local authority name,Local authority code,Turnout (%),Electorate,Total votes,LAB\nE05000001,Central,Example Council,E06000001,50,1000,500,300",
			"politics/elections/local-elections/2021/local_elections_2021_results-2.xlsx#Wards-results":
				"Ward/ED code,Ward/ED name,Local authority name,Local authority code,Turnout (%),Electorate,Total votes,LAB\nE05000001,Central,Example Council,E06000001,50,1000,500,300",
			"politics/elections/local-elections/2019/leap-2019-05-02.csv":
				'"Example Council","E06000001","Central","E05000001","Alex Example","Lab","300","1"',
			"politics/elections/local-elections/2018/leap-2018-05-03.csv":
				'"Example Council","E06000001","Central","E05000001","Alex Example","Lab","300","1"',
			"politics/elections/local-elections/2017/leap-2017-05-04.csv":
				'"Example Council","E06000001","Central","E05000001","Alex Example","Lab","300","1"',
			"politics/elections/local-elections/2016/leap-2016-05-05.csv":
				'"Example Council","E06000001","Central","E05000001","Alex Example","Lab","300","1"',
		};
		const readSource = async (source: ElectionSourceConfig) => {
			const key =
				source.source === "xlsx"
					? `${source.path}#${source.sheet}`
					: source.path;
			const table = tables[key];
			if (!table) throw new Error(`unexpected source: ${key}`);
			return table;
		};

		const datasets = await loadLocalElection(readSource);

		expect(Object.keys(datasets).sort()).toEqual([
			"2016",
			"2017",
			"2018",
			"2019",
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
