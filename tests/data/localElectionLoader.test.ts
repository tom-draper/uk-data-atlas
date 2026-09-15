import {
	effectiveVotes,
	loadLocalElection,
	parseLeapLocalElection,
	parseLocalElectionTable,
	wardCodesByName,
} from "@/lib/data/election/local-election/load";
import {
	ELECTION_SOURCES,
	type ElectionTableSourceConfig,
	type LeapElectionSourceConfig,
} from "@/lib/data/election/local-election/config";

const codedConfig: ElectionTableSourceConfig = {
	year: 2022,
	source: "xlsx",
	path: "wards.xlsx",
	sheet: "Wards",
	fields: {
		code: "Ward code",
		name: "Ward name",
		ladName: "Local authority name",
		ladCode: "Local authority code",
		turnout: "Turnout (%)",
		electorate: "Electorate",
	},
	candidates: {
		sheet: "Candidates",
		fields: {
			code: "Ward code",
			name: "Ward name",
			ladName: "Local authority name",
			party: "Party name",
			votes: "Votes",
		},
	},
};

const uncodedConfig: ElectionTableSourceConfig = {
	year: 2023,
	source: "xlsx",
	path: "wards.xlsx",
	sheet: "Ward_Level",
	fields: {
		name: "WARDNAME",
		ladName: "DISTRICTNAME",
		turnout: "TURNOUT",
		electorate: "ELECT",
	},
	candidates: {
		sheet: "Cand_Table",
		fields: {
			name: "WARDNAME",
			ladName: "DISTRICTNAME",
			party: "PARTYNAME",
			votes: "VOTE",
		},
	},
	wardList: {
		path: "wards.geojson",
		code: "WD23CD",
		name: "WD23NM",
		ladName: "LAD23NM",
	},
};

describe("local election loader", () => {
	it("counts each party's highest-polling candidate and names the top candidate's party", () => {
		expect(
			effectiveVotes([
				{ party: "Labour Party", votes: 900 },
				{ party: "Labour and Co-operative Party", votes: 850 },
				{ party: "CON", votes: 700 },
				{ party: "ASP", votes: 600 },
				{ party: "BFC", votes: 500 },
				{ party: "Lib", votes: 20 },
			]),
		).toEqual({
			partyVotes: { LAB: 900, CON: 700, OTHER: 1120 },
			totalVotes: 2720,
			winner: "LAB",
		});
		expect(
			effectiveVotes([
				{ party: "Conservative and Unionist Party", votes: 0 },
				{ party: "Reform UK", votes: 0, elected: true },
			]).winner,
		).toBe("REF");
	});

	it("takes votes from the candidate sheet and leaves out wards without one official code", () => {
		const dataset = parseLocalElectionTable(
			`"Local election results by ward, 2022"
Ward code,Ward name,Local authority name,Local authority code,Turnout (%),Electorate,LAB,CON,Total votes
E05000001,Central,Example Council,E06000001,40,2000,TRUE,300,301
E05000002,East,Example Council,E06000001,35,1800,0,0,0
E05000002,West,Example Council,E06000001,33,1700,0,0,0
E05000003,North Field,Example Council,E06000001,30,1500,0,0,0
NA,NA,NA,NA,,,,,9000`,
			`"Local election results by candidate, 2022"
Ward code,Ward name,Local authority name,Party name,Votes
E05000001,Central,Example Council,LAB,450
E05000001,Central,Example Council,LAB,410
E05000001,Central,Example Council,CON,300
E05000001,Central,Example Council,GARF IND,380
E05000002,East,Example Council,LD,120
E05000002,West,Example Council,LD,140
E05000003,Northfield,Example Council,CON,500
E05000003,North Field,Example Council,LAB,90
E05000003,Southfield,Example Council,GREEN,0`,
			codedConfig,
		);

		expect(dataset.results).toEqual({ E05000001: "LAB", E05000003: "LAB" });
		// Southfield shares North Field's code in the candidate sheet only, so
		// North Field keeps its own candidates. Its name is spelled differently
		// there too, so its CON candidate is not matched.
		expect(dataset.data.E05000003.partyVotes).toEqual({ LAB: 90 });
		expect(dataset.data.E05000001).toEqual({
			wardCode: "E05000001",
			wardName: "Central",
			ladName: "Example Council",
			ladCode: "E06000001",
			turnoutPercent: 40,
			electorate: 2000,
			totalVotes: 1130,
			partyVotes: { LAB: 450, CON: 300, OTHER: 380 },
		});
		expect(dataset.wardCodes).toBe("published");
		expect(dataset.excludedWards).toEqual([
			{
				wardName: "East",
				ladName: "Example Council",
				wardCode: "E05000002",
				reason: "code-shared-by-wards",
			},
			{
				wardName: "West",
				ladName: "Example Council",
				wardCode: "E05000002",
				reason: "code-shared-by-wards",
			},
		]);
	});

	it("records a corrected ward code alongside the code the source gave", () => {
		const dataset = parseLocalElectionTable(
			`Ward code,Ward name,Local authority name,Local authority code,Turnout (%),Electorate
E05099999,Park,Example Council,E06000001,40,2000`,
			`Ward code,Ward name,Local authority name,Party name,Votes
E05099999,Park,Example Council,LAB,450`,
			{ ...codedConfig, wardCodeMap: { E05099999: "E05000001" } },
		);

		expect(dataset.data).toEqual({
			E05000001: expect.objectContaining({
				wardCode: "E05000001",
				sourceWardCode: "E05099999",
				partyVotes: { LAB: 450 },
			}),
		});
	});

	it("matches a workbook without codes to the official ward list by exact name", () => {
		const wardList = wardCodesByName(
			JSON.stringify({
				type: "FeatureCollection",
				features: [
					["E05000001", "St John's", "Bath and North East Somerset"],
					["E05000002", "Central", "Example Council"],
					["E05000003", "Central", "Example Council"],
				].map(([WD23CD, WD23NM, LAD23NM]) => ({
					type: "Feature",
					properties: { WD23CD, WD23NM, LAD23NM },
					geometry: null,
				})),
			}),
			uncodedConfig.wardList!,
		);
		const dataset = parseLocalElectionTable(
			`WARDNAME,DISTRICTNAME,TURNOUT,ELECT
St. Johns,Bath & North East Somerset,30,1000
Central,Example Council,31,1100
Nowhere,Example Council,32,1200`,
			`WARDNAME,DISTRICTNAME,PARTYNAME,VOTE
ST. JOHNS,Bath & North East Somerset,GREEN,210
Central,Example Council,LAB,100
Nowhere,Example Council,LAB,100`,
			uncodedConfig,
			wardList,
		);

		expect(Object.keys(dataset.data)).toEqual(["E05000001"]);
		expect(dataset.data.E05000001).toMatchObject({
			wardName: "St. Johns",
			partyVotes: { GREEN: 210 },
		});
		expect(dataset.wardCodes).toBe("name-matched");
		expect(dataset.excludedWards?.map((ward) => ward.reason)).toEqual([
			"name-ambiguous",
			"name-not-in-ward-list",
		]);
	});

	it("counts LEAP candidates the same way and excludes Scottish STV records", () => {
		const config: LeapElectionSourceConfig = {
			year: 2019,
			source: "leap",
			path: "leap.csv",
		};
		const dataset = parseLeapLocalElection(
			`"Example Council","E06000001","Central","E05000001","Alex Example","Lab","320","1"
"Example Council","E06000001","Central","E05000001","Jo Example","Lab","300","1"
"Example Council","E06000001","Central","E05000001","Sam Example","C","280","0"
"Example Council","E06000001","Central","E05000001","Lee Example","Lib","40","0"
"Example Council","E06000001","Uncontested","E05000002","Alex Example","Lab","0","1"
"Scottish Council","S12000001","North","S13000001","Casey Example","SNP","400","1"`,
			config,
		);

		expect(dataset.results).toEqual({
			E05000001: "LAB",
			E05000002: "LAB",
		});
		expect(dataset.data.E05000001).toMatchObject({
			totalVotes: 640,
			turnoutPercent: 0,
			electorate: 0,
			partyVotes: { LAB: 320, CON: 280, OTHER: 40 },
		});
	});

	it("reads each configured ward sheet, candidate sheet and ward list", async () => {
		const wardSheet = (config: ElectionTableSourceConfig) => {
			const { fields } = config;
			const headers = [
				fields.code,
				fields.name,
				fields.ladName,
				fields.turnout,
				fields.electorate,
			].filter((header) => header !== undefined);
			const values = [
				fields.code ? "E05000001" : undefined,
				"Central",
				"Example Council",
				"50",
				"1000",
			].filter((value) => value !== undefined);
			return `${headers.join(",")}\n${values.join(",")}`;
		};
		const candidateSheet = (config: ElectionTableSourceConfig) => {
			const { fields } = config.candidates;
			const headers = [
				fields.code,
				fields.name,
				fields.ladName,
				fields.party,
				fields.votes,
			].filter((header) => header !== undefined);
			const values = [
				fields.code ? "E05000001" : undefined,
				"Central",
				"Example Council",
				"LAB",
				"300",
			].filter((value) => value !== undefined);
			return `${headers.join(",")}\n${values.join(",")}`;
		};
		const reads: string[] = [];
		const datasets = await loadLocalElection({
			text: async (path) => {
				reads.push(path);
				if (path.endsWith(".geojson")) {
					return JSON.stringify({
						features: [
							{
								properties: {
									WD23CD: "E05000001",
									WD23NM: "Central",
									LAD23NM: "Example Council",
								},
							},
						],
					});
				}
				return '"Example Council","E06000001","Central","E05000001","Alex Example","Lab","300","1"';
			},
			xlsxSheet: async (path, sheet) => {
				reads.push(`${path}#${sheet}`);
				const config = Object.values(ELECTION_SOURCES).find(
					(source): source is ElectionTableSourceConfig =>
						source.source === "xlsx" && source.path === path,
				);
				if (!config) throw new Error(`unexpected workbook: ${path}`);
				return sheet === config.sheet
					? wardSheet(config)
					: candidateSheet(config);
			},
		});

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
		for (const dataset of Object.values(datasets)) {
			expect(dataset.data.E05000001).toMatchObject({
				wardName: "Central",
				partyVotes: { LAB: 300 },
			});
		}
		expect(datasets[2023].wardCodes).toBe("name-matched");
		expect(reads).toContain(
			"politics/elections/local-elections/2023/LEH-Candidates-2023.xlsx#Cand_Table",
		);
	});
});
