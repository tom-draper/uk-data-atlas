import { parseCsv } from "../../../helpers/parseCsv.ts";
import { sourceDir } from "../../../declaration/sources.ts";
import type { DirectRecord } from "../../../declaration/statistics.ts";
import type { BroadbandDataset } from "../../../types/broadband.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { PREMISES, measure } from "../../../declaration/measures.ts";
import { periods } from "../../../declaration/statistics.ts";
import { aggregateBroadband } from "./aggregate.ts";
import { loadBroadband } from "./loader.ts";

const WEIGHT = {
	kind: "weighted-mean",
	weight: {
		description:
			"The authority's count of all premises, which the published availability percentages are computed against.",
		datasetField: "All Premises",
	},
} as const;

export const broadband = defineDataset<BroadbandDataset>({
	id: "broadband",
	topic: "digital-connectivity",
	source: {
		name: "Broadband Coverage",
		publisher: "Ofcom",
		sourceUrl:
			"https://www.ofcom.org.uk/research-and-data/telecoms-research/connected-nations",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Ofcom. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Fixed broadband coverage by local authority district across the UK.",
		year: "2025",
		cadence: "annual",
		notes: [
			"Availability, not take-up: a premises counts where the service can be ordered, whether or not anyone there has it.",
			"This is a share of premises, so it does not add over areas. Combining authorities needs a mean weighted by premises, which the source publishes but this measure does not serve; averaging the percentages flat would weigh a small authority as heavily as a city.",
			"Ofcom's July 2025 Connected Nations snapshot, on local authority codes shared by every release from May 2023 to December 2024.",
		],
	},
	boundary: { type: "localAuthority", year: 2024 },
	load: ({ text }) => loadBroadband(text),
	placeHeadline: {
		places: ["localAuthority"],
		order: 90,
		label: "Full fibre",
		about: "Premises that can get full-fibre broadband",
		format: { kind: "decimal", digits: 0, suffix: "%" },
	},
	statistics: {
		payload: { code: "ladCode" },
		name: "ladName",
		period: () => periods.month(2025, 7),
		measures: [
			PREMISES,
			measure(
				"broadband-availability",
				"Broadband availability",
				"percent of premises",
				"share",
				"weighted_mean",
				"Premises that can get fixed broadband at the speed, as a percentage of premises.",
				{ weight: PREMISES.slug },
			),
		],
		dimensions: [
			{
				slug: "broadband-speed",
				label: "Broadband speed",
				members: [
					{
						key: "pctSuperfast",
						code: "superfast",
						label: "Superfast (30 Mbit/s or more)",
					},
					{
						key: "pctUltrafast",
						code: "ultrafast",
						label: "Ultrafast (300 Mbit/s or more)",
					},
					{
						key: "pctFullFibre",
						code: "full-fibre",
						label: "Full fibre",
					},
					{
						key: "pctGigabit",
						code: "gigabit",
						label: "Gigabit capable",
					},
				],
			},
		],
		direct: {
			read: async ({ text }) => {
				const { data } = await parseCsv<Record<string, string>>(
					await text(
						sourceDir(
							"broadband",
							"202507_fixed_laua_coverage_r01.csv",
						),
					),
					{ header: true },
				);
				const parse = (v: string | undefined) => {
					if (!v || v === "N/A" || v === "-" || v === "..")
						return null;
					const n = parseFloat(
						v.replace(/,/g, "").replace(/%/, "").trim(),
					);
					return isNaN(n) ? null : n;
				};
				const records = new Map<string, DirectRecord>();
				for (const row of data) {
					const code = (row.laua ?? "").trim();
					const name = (row.laua_name ?? "").trim();
					if (!code || !name || !/^[EWSN][0-9]/.test(code)) continue;
					const fields = [
						["pctSuperfast", "SFBB availability (% premises)"],
						[
							"pctUltrafast",
							"UFBB (100Mbit/s) availability (% premises)",
						],
						[
							"pctFullFibre",
							"Full Fibre availability (% premises)",
						],
						["pctGigabit", "Gigabit availability (% premises)"],
					] as const;
					records.set(code, {
						code,
						name,
						values: [
							...fields.map(([key, column]) => ({
								measure: "broadband-availability",
								members: { "broadband-speed": key },
								value: parse(row[column]),
							})),
							{
								measure: "premises",
								value: parse(row["All Premises"]),
							},
						],
					});
				}
				return [{ key: "2025", records: [...records.values()] }];
			},
		},
		fields: [
			{ path: "{broadband-speed}", measure: "broadband-availability" },
			{ path: "premisesCount", measure: "premises" },
		],
	},
	catalogue: {
		kind: "indicators",
		period: "2025-07",
		codes: "authorities",
		coverageNote:
			"Published source records cover every authority in all four UK nations.",
		indicators: [
			{
				id: "broadband-superfast-availability",
				label: "Superfast broadband availability",
				field: "pctSuperfast",
				valueKind: "ratio",
				unit: "% of premises",
				aggregation: WEIGHT,
				notes: [
					"Premises able to receive download speeds of at least 30 Mbit/s.",
				],
				measure: "broadband-availability",
				members: { "broadband-speed": "superfast" },
			},
			{
				id: "broadband-ultrafast-availability",
				label: "Ultrafast broadband availability",
				field: "pctUltrafast",
				valueKind: "ratio",
				unit: "% of premises",
				aggregation: WEIGHT,
				notes: [
					"Premises able to receive download speeds of at least 100 Mbit/s.",
				],
				measure: "broadband-availability",
				members: { "broadband-speed": "ultrafast" },
			},
			{
				id: "broadband-full-fibre-availability",
				label: "Full fibre availability",
				field: "pctFullFibre",
				valueKind: "ratio",
				unit: "% of premises",
				aggregation: WEIGHT,
				notes: [
					"Premises where a full fibre connection, fibre all the way to the premises, is available.",
				],
				measure: "broadband-availability",
				members: { "broadband-speed": "full-fibre" },
			},
			{
				id: "broadband-gigabit-availability",
				label: "Gigabit broadband availability",
				field: "pctGigabit",
				valueKind: "ratio",
				unit: "% of premises",
				aggregation: WEIGHT,
				notes: [
					"Premises able to receive download speeds of at least 1 Gbit/s, by any technology.",
				],
				measure: "broadband-availability",
				members: { "broadband-speed": "gigabit" },
			},
		],
	},
	ranking: {
		label: "Premises with full fibre",
	},
	display: {
		label: "Fixed Broadband Coverage [2025]",
		year: 2025,
		card: {
			heading: "Broadband",
			coverage: "United Kingdom",
			source: "Ofcom. Connected Nations Report 2025. ofcom.org.uk",
			pills: [
				{
					label: "Superfast",
					field: "pctSuperfast",
					unit: "%",
					digits: 0,
				},
				{
					label: "Ultrafast",
					field: "pctUltrafast",
					unit: "%",
					digits: 0,
				},
				{ label: "Gigabit", field: "pctGigabit", unit: "%", digits: 0 },
			],
			appearance: { layout: "pills", accent: "#6366f1" },
		},
		measures: [
			{
				id: "fullFibre",
				label: "Full",
				field: "pctFullFibre",
				colorRange: { min: 50, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 0,
						suffix: "% full fibre",
					},
				},
				card: {
					heading: "Full Fibre Broadband",
					unit: "%",
					digits: 0,
					maximum: 100,
				},
			},
			{
				id: "superfast",
				label: "Super",
				field: "pctSuperfast",
				colorRange: { min: 70, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 0,
						suffix: "% superfast",
					},
				},
				card: {
					heading: "Superfast Broadband",
					unit: "%",
					digits: 0,
					maximum: 100,
				},
			},
			{
				id: "ultrafast",
				label: "Ultra",
				field: "pctUltrafast",
				colorRange: { min: 30, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 0,
						suffix: "% ultrafast",
					},
				},
				card: {
					heading: "Ultrafast Broadband",
					unit: "%",
					digits: 0,
					maximum: 100,
				},
			},
			{
				id: "gigabit",
				label: "Gig",
				field: "pctGigabit",
				colorRange: { min: 50, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: { kind: "decimal", digits: 0, suffix: "% gigabit" },
				},
				card: {
					heading: "Gigabit Broadband",
					unit: "%",
					digits: 0,
					maximum: 100,
				},
			},
		],
		aggregation: {
			scope: "localAuthority",
			aggregate: aggregateBroadband,
		},
	},
});
