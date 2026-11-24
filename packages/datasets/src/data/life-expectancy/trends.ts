import type { PlaceTrendDeclaration } from "../../declaration/dataset.ts";

const lifeExpectancy = (
	sex: "female" | "male",
	order: number,
	label: string,
): PlaceTrendDeclaration => ({
	key: `life-expectancy-${sex}`,
	places: ["localAuthority"],
	order,
	label,
	measure: "life-expectancy",
	dimensions: { sex },
	format: { kind: "decimal", digits: 1, suffix: " years" },
	change: "difference",
});

/**
 * Life expectancy at birth by sex, charted on council pages. The map's
 * dataset and the longer series declare it alike, and a council charts
 * whichever holds more periods for it.
 */
export const LIFE_EXPECTANCY_TRENDS: readonly PlaceTrendDeclaration[] = [
	lifeExpectancy("female", 40, "Life expectancy, women"),
	lifeExpectancy("male", 41, "Life expectancy, men"),
];
