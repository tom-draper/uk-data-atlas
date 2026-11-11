import type { DeclaredDimension } from "../../declaration/statistics.ts";
/** Single years of age, with 90 meaning 90 and over. */
export const AGE: DeclaredDimension = {
	slug: "age",
	label: "Age",
	members: Array.from({ length: 91 }, (_, age) => ({
		key: String(age),
		code: age === 90 ? "90-plus" : String(age),
		label: age === 90 ? "Aged 90 and over" : `Aged ${age}`,
	})),
};

export const byAge = [
	{ path: "total.{age}", measure: "population", members: { sex: "all" } },
	{ path: "males.{age}", measure: "population", members: { sex: "male" } },
	{
		path: "females.{age}",
		measure: "population",
		members: { sex: "female" },
	},
];
