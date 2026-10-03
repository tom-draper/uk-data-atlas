import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { compileMapFigures, type FigureInputs } from "../lib/atlas/figures";

const DATASETS = join(process.cwd(), "public", "data", "datasets");
export const MAP_FIGURES_PATH = join(DATASETS, "map-figures.json");

const FILES: Record<keyof FigureInputs, string> = {
	populationUk: "population-uk.json",
	landArea: "land-area.json",
	housePrice: "house-price.json",
	crime: "crime.json",
	lifeExpectancy: "life-expectancy.json",
	income: "income.json",
	childPoverty: "child-poverty.json",
	broadband: "broadband.json",
	mobileCoverage: "mobile-coverage.json",
	businessActivity: "business-activity.json",
	electricVehicleChargers: "electric-vehicle-chargers.json",
	councilTax: "council-tax.json",
	claimantCount: "claimant-count.json",
	homelessness: "homelessness.json",
	ghgEmissions: "ghg-emissions.json",
};

export async function readFigureInputs(): Promise<FigureInputs> {
	const entries = await Promise.all(
		Object.entries(FILES).map(async ([key, file]) => [
			key,
			JSON.parse(await readFile(join(DATASETS, file), "utf8")),
		]),
	);
	return Object.fromEntries(entries) as FigureInputs;
}

export function serialiseMapFigures(inputs: FigureInputs) {
	return `${JSON.stringify(compileMapFigures(inputs), null, "\t")}\n`;
}
