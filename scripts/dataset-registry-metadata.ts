export type CatalogueDefinitionMetadata = {
	name: string;
	type: string;
};

export type ChartDefinitionMetadata = {
	name: string;
	type: string;
	charts: Array<{ key: string; componentPath: string }>;
};

type ModuleExports = Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const fail = (file: string, message: string): never => {
	throw new Error(`${file} ${message}`);
};

export function catalogueMetadata(
	file: string,
	module: ModuleExports,
): CatalogueDefinitionMetadata {
	const matches: Array<[string, Record<string, unknown>]> = [];
	for (const [name, value] of Object.entries(module)) {
		if (name.endsWith("DatasetDefinition") && isRecord(value) && typeof value.precompile === "function") {
			matches.push([name, value]);
		}
	}
	if (matches.length !== 1) return fail(file, "must export exactly one *DatasetDefinition value.");
	const [name, definition] = matches[0];
	if (typeof definition.type !== "string") {
		return fail(file, "must declare a string literal dataset type.");
	}
	return { name, type: definition.type };
}

export function chartMetadata(file: string, module: ModuleExports): ChartDefinitionMetadata {
	const matches: Array<[string, Record<string, unknown>]> = [];
	for (const [name, value] of Object.entries(module)) {
		if (name.endsWith("Definition") && isRecord(value) && "chart" in value) {
			matches.push([name, value]);
		}
	}
	if (matches.length !== 1) return fail(file, "must export exactly one chart *Definition value.");
	const [name, definition] = matches[0];
	if (typeof definition.type !== "string") {
		return fail(file, "must spread a catalogue definition with a string dataset type.");
	}
	const chartValues = Array.isArray(definition.charts) ? definition.charts : [definition.chart];
	if (chartValues.length === 0) return fail(file, "must declare at least one chart.");
	const charts = chartValues.map((chart) => {
		if (!isRecord(chart) || typeof chart.key !== "string" || typeof chart.componentPath !== "string") {
			return fail(file, "must declare string chart keys and component paths.");
		}
		return { key: chart.key, componentPath: chart.componentPath };
	});
	return { name, type: definition.type, charts };
}
