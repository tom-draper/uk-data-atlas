import { type DeclaredDataset, periods } from "../declaredStatistics.ts";
import { yearParts } from "../declaredPayload.ts";
import { PREMISES, measure, per100k } from "./measures.ts";

/** Energy, emissions, air, land, waste and connectivity. */

const METER_TYPE = {
	slug: "meter-type",
	label: "Meter type",
	members: [
		{ key: "allMetersGwh", code: "all", label: "All meters" },
		{
			key: "domesticGwh",
			code: "domestic",
			label: "Domestic",
			parent: "allMetersGwh",
		},
		{
			key: "nonDomesticGwh",
			code: "non-domestic",
			label: "Non-domestic",
			parent: "allMetersGwh",
		},
	],
};

const consumption = (type: string, fuel: "electricity" | "gas") => ({
	type,
	module: "environment" as const,
	payload: {
		parts: yearParts(type, "localAuthority", 2025, {
			coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT"],
		}),
		code: "ladCode",
	},
	name: "ladName",
	measures: [
		measure(
			`${fuel}-consumption`,
			`${fuel === "gas" ? "Gas" : "Electricity"} consumption`,
			"gwh",
			"amount",
			"sum",
			`Metered ${fuel} consumption in gigawatt hours.`,
		),
		measure(
			`${fuel}-meters`,
			`${fuel === "gas" ? "Gas" : "Electricity"} meters`,
			"thousand meters",
			"count",
			"sum",
			`${fuel === "gas" ? "Gas" : "Electricity"} meters, in thousands.`,
		),
	],
	dimensions: [METER_TYPE],
	fields: [
		{ path: "{meter-type}", measure: `${fuel}-consumption` },
		{ path: "metersThousands", measure: `${fuel}-meters` },
	],
	...per100k((record) => record.allMetersGwh),
});
export const ELECTRICITY_CONSUMPTION: DeclaredDataset = consumption(
	"electricityConsumption",
	"electricity",
);
export const GAS_CONSUMPTION: DeclaredDataset = consumption(
	"gasConsumption",
	"gas",
);

export const WASTE: DeclaredDataset = {
	type: "waste",
	module: "environment",
	payload: {
		parts: yearParts(
			"waste",
			"localAuthority",
			2025,
			{
				coverageCountries: ["GB-ENG"],
			},
			["2025"],
		),
		code: "code",
	},
	name: "name",
	period: () => periods.financialYear(2024),
	measures: [
		measure(
			"collected-waste",
			"Local authority collected waste",
			"tonnes",
			"amount",
			"sum",
			"Waste collected by the local authority, collection authorities only.",
		),
		measure(
			"household-waste-recycled",
			"Household waste sent for recycling",
			"tonnes",
			"amount",
			"sum",
			"Household waste sent for reuse, recycling or composting.",
		),
	],
	fields: [
		{ path: "value", measure: "collected-waste" },
		{ path: "metrics.recycledTonnes", measure: "household-waste-recycled" },
	],
	...per100k((record) => record.value, 2024),
};
