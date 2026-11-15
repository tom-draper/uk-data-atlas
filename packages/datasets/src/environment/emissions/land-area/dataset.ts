import type { LandAreaDataset } from "../../../types/landArea.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { measure } from "../../../declaration/measures.ts";
import { loadLandArea } from "../../../data/land-area/loader.ts";
import { parseNum } from "../../../helpers/parseNumber.ts";
import { sourceDir } from "../../../declaration/sources.ts";
import type { DirectRecord } from "../../../declaration/statistics.ts";

export const landArea = defineDataset<LandAreaDataset>({
	id: "land-area",
	topic: "emissions",
	source: {
		name: "Land Area",
		publisher: "Office for National Statistics",
		sourceUrl:
			"https://geoportal.statistics.gov.uk/datasets/standard-area-measurements-for-the-local-authority-districts-december-2024-in-the-uk",
		year: "2024",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Standard Area Measurements by local authority district across the UK: land area excluding inland water, alongside the extent of the realm and inland water, in hectares.",
		cadence: "irregular",
		notes: [],
	},
	boundary: { type: "localAuthority", year: 2024 },
	coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
	chartPending: true,
	ingestion: {
		minimumDataRecords: 361,
		expectedBoundaryYears: [2024],
		requiredDataFields: ["landHectares", "landSquareKm"],
	},
	load: ({ text }) => loadLandArea(text),
	statistics: {
		payload: {
			header: {
				coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
			},
			code: "ladCode",
		},
		name: "ladName",
		measures: [
			measure(
				"area",
				"Area",
				"hectares",
				"amount",
				"sum",
				"Area of the boundary, in hectares.",
			),
		],
		dimensions: [
			{
				slug: "surface",
				label: "Surface",
				members: [
					{
						key: "extentHectares",
						code: "extent",
						label: "Extent to mean high water",
					},
					{
						key: "landHectares",
						code: "land",
						label: "Land",
						parent: "extentHectares",
					},
					{
						key: "inlandWaterHectares",
						code: "inland-water",
						label: "Inland water",
						parent: "extentHectares",
					},
				],
			},
		],
		fields: [{ path: "{surface}", measure: "area" }],
		// The rows come straight from the CSV; `load` above only feeds the manifest
		// and the check that the rows rebuild its payload.
		direct: {
			read: async (reader) => {
				const records = new Map<string, DirectRecord>();
				await reader.csvRows(
					sourceDir("land-area", "sam-lad-2024-12.csv"),
					{},
					(row) => {
						const code = row["ladCode"]?.trim();
						if (!code) return;
						const value = (column: string, surface: string) => ({
							measure: "area",
							members: { surface },
							value: parseNum(row[column]),
						});
						records.set(code, {
							code,
							name: row["ladName"]?.trim() || "",
							values: [
								value("landHectares", "landHectares"),
								value("extentHectares", "extentHectares"),
								value(
									"inlandWaterHectares",
									"inlandWaterHectares",
								),
							],
						});
					},
				);
				return [{ key: "2024", records: [...records.values()] }];
			},
		},
		derived: { landSquareKm: "Land hectares in square kilometres." },
		computed: {
			landSquareKm: (record) => (record.landHectares as number) / 100,
		},
	},
});
