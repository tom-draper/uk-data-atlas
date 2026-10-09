import { describe, expect, it } from "vitest";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import { getChartDefinitions } from "@/lib/datasets/types";
import { claimantCountDefinition } from "@/lib/datasets/claimantCount";
import { councilTaxDefinition } from "@/lib/datasets/councilTax";
import { crimeDefinition } from "@/lib/datasets/crime";
import { electricityConsumptionDefinition } from "@/lib/datasets/electricityConsumption";
import { nhsWaitingDefinition } from "@/lib/datasets/nhsWaiting";
import { resolveValueCardStats } from "@/lib/helpers/valueCardStats";
import type { SelectedArea } from "@/lib/types";

const area = (
	type: SelectedArea["type"],
	code: string,
	data: unknown = null,
): SelectedArea => ({ type, code, name: code, data }) as SelectedArea;

const claimantCard = claimantCountDefinition.chart.card!;
const claimants = {
	boundaryType: "localAuthority",
	boundaryYear: 2023,
	data: {
		E08000001: {
			totalCount: 9_000,
			totalRate: 4.25,
			youthCount: 1_000,
			youthRate: 5.5,
		},
	},
};
const toBolton = { getLadForWard: () => "E08000001" };

describe("resolveValueCardStats", () => {
	it("shows the aggregate when no area is selected", () => {
		expect(
			resolveValueCardStats(
				claimantCard,
				claimants,
				{ totalRate: 3, youthRate: 4 },
				null,
				undefined,
				false,
			),
		).toEqual({
			stats: { value: 3, secondary: "4.0% youth" },
			viaLocalAuthority: false,
		});
	});

	it("reads a local authority's own record", () => {
		expect(
			resolveValueCardStats(
				claimantCard,
				claimants,
				null,
				area("localAuthority", "E08000001"),
				undefined,
				false,
			),
		).toEqual({
			stats: { value: 4.25, secondary: "5.5% youth" },
			viaLocalAuthority: false,
		});
	});

	it("rolls a ward up to its authority and says so", () => {
		expect(
			resolveValueCardStats(
				claimantCard,
				claimants,
				null,
				area("ward", "E05000001"),
				toBolton,
				false,
			),
		).toMatchObject({ stats: { value: 4.25 }, viaLocalAuthority: true });
	});

	it("maps an authority code into the dataset's boundary vintage", () => {
		expect(
			resolveValueCardStats(
				claimantCard,
				claimants,
				null,
				area("localAuthority", "E06000999"),
				{
					getCodeForYear: (_type, code, year) =>
						code === "E06000999" && year === 2023
							? "E08000001"
							: undefined,
				},
				false,
			)?.stats.value,
		).toBe(4.25);
	});

	it("reports nothing for an area the dataset does not cover", () => {
		expect(
			resolveValueCardStats(
				claimantCard,
				claimants,
				null,
				area("constituency", "E14000001"),
				toBolton,
				false,
			),
		).toBeNull();
	});

	it("looks waiting times up through the authority's care board", () => {
		const waiting = {
			boundaryType: "localAuthority",
			boundaryYear: 2025,
			ladToIcb: { E08000001: "E54000057" },
			data: {
				E54000057: {
					icbCode: "E54000057",
					icbName: "Greater Manchester",
					total: 100,
					over18Weeks: 36,
					pctOver18Weeks: 36,
				},
			},
		};
		expect(
			resolveValueCardStats(
				nhsWaitingDefinition.chart.card!,
				waiting,
				null,
				area("ward", "E05000001"),
				toBolton,
				false,
			),
		).toEqual({
			stats: { value: 36, secondary: "target <8%" },
			viaLocalAuthority: true,
		});
	});

	it("treats an unattributed crime total as missing", () => {
		const crime = {
			boundaryType: "localAuthority",
			boundaryYear: 2023,
			data: { E08000001: { totalRecordedCrime: 0 } },
		};
		const card = crimeDefinition.chart.card!;
		expect(
			resolveValueCardStats(
				card,
				crime,
				null,
				area("localAuthority", "E08000001"),
				undefined,
				false,
			),
		).toBeNull();
		expect(
			resolveValueCardStats(
				card,
				crime,
				{ averageRecordedCrime: 12_345 },
				null,
				undefined,
				false,
			)?.stats.value,
		).toBe(12_345);
	});

	it("shows total electricity use and the domestic share", () => {
		const electricity = {
			boundaryType: "localAuthority",
			boundaryYear: 2025,
			data: {
				E08000001: {
					ladCode: "E08000001",
					ladName: "Bolton",
					domesticGwh: 120,
					nonDomesticGwh: 80,
					allMetersGwh: 200,
					metersThousands: 50,
				},
			},
		};
		const card = electricityConsumptionDefinition.chart.card!;

		expect(
			resolveValueCardStats(
				card,
				electricity,
				{
					domesticGwh: 300,
					nonDomesticGwh: 200,
					allMetersGwh: 500,
					metersThousands: 125,
				},
				null,
				undefined,
				false,
			),
		).toEqual({
			stats: { value: 500, secondary: "60% domestic" },
			viaLocalAuthority: false,
		});
		expect(
			resolveValueCardStats(
				card,
				electricity,
				null,
				area("localAuthority", "E08000001"),
				undefined,
				false,
			),
		).toEqual({
			stats: { value: 200, secondary: "60% domestic" },
			viaLocalAuthority: false,
		});
	});

	it("falls back to the map's hover record only for the active indicator", () => {
		const councilTax = {
			boundaryType: "localAuthority",
			boundaryYear: 2026,
			data: {},
		};
		const hovered = area("ward", "E05000001", { value: 2_100 });
		const card = councilTaxDefinition.chart.card!;
		expect(
			resolveValueCardStats(
				card,
				councilTax,
				null,
				hovered,
				undefined,
				true,
			),
		).toEqual({
			stats: { value: 2_100, secondary: "Avg Band D" },
			viaLocalAuthority: false,
		});
		expect(
			resolveValueCardStats(
				card,
				councilTax,
				null,
				hovered,
				undefined,
				false,
			),
		).toBeNull();
	});
});

describe("value card registrations", () => {
	it("gives every chart rendered by the shared card a declaration", () => {
		const charts = CHART_DATASET_DEFINITIONS.flatMap((definition) =>
			getChartDefinitions(definition),
		).filter((chart) => chart.componentPath === "@/components/ValueCard");

		expect(charts.length).toBeGreaterThan(0);
		for (const chart of charts) expect(chart.card, chart.key).toBeDefined();
	});
});
