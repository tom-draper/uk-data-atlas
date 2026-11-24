import type { DatasetDeclaration } from "./dataset.ts";
import { UPDATE_CADENCES } from "./cadence.ts";
import type { DeclaredDimension } from "./statistics.ts";

/**
 * What makes a declaration complete and consistent, checked when the module
 * that declares it is first imported. The API catalogue, the statistics rows,
 * the manifest and the website all read the declaration, so a bad one is
 * refused here, at typecheck, test and build time, rather than surfacing as a
 * wrong or missing figure in one of them.
 */

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const HTTP_URL = /^https?:\/\/\S+$/;
const BINDING = /\{([^}]+)\}/g;

const blank = (value: unknown): boolean =>
	typeof value !== "string" || value.trim() === "";

const sorted = (members: Readonly<Record<string, string>> | undefined) =>
	Object.entries(members ?? {}).sort(([a], [b]) => (a < b ? -1 : 1));

const duplicates = (values: readonly string[]): string[] =>
	values.filter((value, index) => values.indexOf(value) !== index);

/** The codes a dimension's declared members can be named by, if it lists any. */
function memberCodes(dimension: DeclaredDimension): Set<string> | undefined {
	if (!dimension.members) return undefined;
	return new Set(
		dimension.members.map((member) => member.code ?? member.key),
	);
}

/**
 * Every problem with a declaration, each a sentence that names the field to
 * fix. Empty when the declaration is well formed.
 */
export function declarationProblems(declaration: DatasetDeclaration): string[] {
	const problems: string[] = [];
	const problem = (message: string) => problems.push(message);

	if (!KEBAB.test(declaration.id))
		problem(`id ${declaration.id} is not kebab-case`);

	for (const key of ["title", "about"] as const)
		if (blank(declaration.guide[key])) problem(`guide.${key} is empty`);
	for (const key of ["summary", "publishedOn"] as const) {
		const text = declaration.guide[key];
		if (text !== undefined && blank(text))
			problem(`guide.${key} is empty, leave it out instead`);
	}

	const { source } = declaration;
	for (const key of [
		"name",
		"publisher",
		"licence",
		"attribution",
		"description",
		"year",
	] as const)
		if (blank(source[key])) problem(`source.${key} is empty`);
	for (const key of ["sourceUrl", "licenceUrl"] as const)
		if (!HTTP_URL.test(source[key] ?? ""))
			problem(`source.${key} is not an http(s) URL`);
	if (!UPDATE_CADENCES.includes(source.cadence))
		problem(`source.cadence ${source.cadence} is not a known cadence`);
	if (!Array.isArray(source.notes) || source.notes.some(blank))
		problem("source.notes must be a list of non-empty sentences");

	for (const folder of declaration.sources ?? []) {
		for (const key of ["name", "folder", "exception"] as const)
			if (folder[key] !== undefined && blank(folder[key]))
				problem(`a source folder has an empty ${key}`);
		if (folder.name !== undefined && !/^[a-z][a-z0-9-]*$/.test(folder.name))
			problem(`source name ${folder.name} is not kebab-case`);
	}
	if (declaration.sources?.length === 0)
		problem(
			"sources is empty, leave it out to read the folder named for the id",
		);

	const { year } = declaration.boundary;
	if (!Number.isInteger(year) || year < 1900 || year > 2100)
		problem(`boundary.year ${year} is not a year`);

	const { statistics } = declaration;
	const measures = statistics.measures.map(({ slug }) => slug);
	if (measures.length === 0) problem("statistics.measures is empty");
	for (const slug of duplicates(measures))
		problem(`statistics.measures repeats ${slug}`);
	for (const measure of statistics.measures) {
		if (!KEBAB.test(measure.slug))
			problem(`measure ${measure.slug} is not kebab-case`);
		for (const key of ["label", "description", "unit"] as const)
			if (blank(measure[key]))
				problem(`measure ${measure.slug} has no ${key}`);
	}

	const dimensions = new Map(
		(statistics.dimensions ?? []).map((dimension) => [
			dimension.slug,
			dimension,
		]),
	);
	for (const slug of duplicates(
		(statistics.dimensions ?? []).map(({ slug }) => slug),
	))
		problem(`statistics.dimensions repeats ${slug}`);
	for (const dimension of statistics.dimensions ?? []) {
		if (blank(dimension.label))
			problem(`dimension ${dimension.slug} has no label`);
		const members = dimension.members ?? [];
		const keys = members.map(({ key }) => key);
		for (const key of duplicates(keys))
			problem(`dimension ${dimension.slug} repeats member key ${key}`);
		for (const code of duplicates(members.map((m) => m.code ?? m.key)))
			problem(`dimension ${dimension.slug} repeats member code ${code}`);
		for (const member of members)
			if (member.parent !== undefined && !keys.includes(member.parent))
				problem(
					`dimension ${dimension.slug} member ${member.key} has parent ${member.parent}, which is not a member`,
				);
	}

	const checkMembers = (
		where: string,
		members: Readonly<Record<string, string>> | undefined,
	) => {
		for (const [slug, code] of Object.entries(members ?? {})) {
			const dimension = dimensions.get(slug);
			if (!dimension) {
				problem(
					`${where} names dimension ${slug}, which is not declared`,
				);
				continue;
			}
			const codes = memberCodes(dimension);
			if (codes && !codes.has(code))
				problem(
					`${where} names ${slug} member ${code}, which the dimension does not declare`,
				);
		}
	};

	if (Array.isArray(statistics.fields)) {
		for (const field of statistics.fields) {
			if (!measures.includes(field.measure))
				problem(
					`field ${field.path} reads measure ${field.measure}, which is not declared`,
				);
			for (const [, name] of field.path.matchAll(BINDING))
				if (name !== "period" && !dimensions.has(name))
					problem(
						`field ${field.path} binds dimension ${name}, which is not declared`,
					);
			checkMembers(`field ${field.path}`, field.members);
		}
	}

	const { catalogue } = declaration;
	if (catalogue) {
		if (catalogue.indicators.length === 0)
			problem("catalogue.indicators is empty");
		if (catalogue.yearly && catalogue.period !== undefined)
			problem("catalogue sets both period and yearly");
		if (!catalogue.yearly && blank(catalogue.period))
			problem("catalogue needs a period, or yearly");
		if (
			catalogue.authorityCodes?.global ||
			catalogue.authorityCodes?.sticky
		)
			problem("catalogue.authorityCodes must not be global or sticky");
		if (blank(catalogue.coverageNote))
			problem("catalogue.coverageNote is empty");
		for (const id of duplicates(catalogue.indicators.map(({ id }) => id)))
			problem(`catalogue repeats indicator ${id}`);
		for (const indicator of catalogue.indicators) {
			const where = `indicator ${indicator.id}`;
			if (!KEBAB.test(indicator.id))
				problem(`${where} is not kebab-case`);
			for (const key of ["label", "field", "unit"] as const)
				if (blank(indicator[key])) problem(`${where} has no ${key}`);
			if (!measures.includes(indicator.measure))
				problem(
					`${where} reads measure ${indicator.measure}, which is not declared`,
				);
			checkMembers(where, indicator.members);
			// A field the indicator reads by its own path must be the series
			// the indicator names, so the API and the rows never disagree.
			if (Array.isArray(statistics.fields)) {
				const read = statistics.fields.find(
					(field) => field.path === indicator.field,
				);
				if (
					read &&
					(read.measure !== indicator.measure ||
						JSON.stringify(sorted(read.members)) !==
							JSON.stringify(sorted(indicator.members)))
				)
					problem(
						`${where} reads field ${indicator.field}, which is declared as a different series`,
					);
			}
			const { aggregation } = indicator;
			if (aggregation !== "sum" && aggregation.kind === "weighted-mean")
				if (blank(aggregation.weight.datasetField))
					problem(`${where} names no weight field`);
		}
	}

	const display = declaration.display;
	if (display) {
		const ids = display.measures.map(({ id }) => id);
		if (ids.length === 0) problem("display.measures is empty");
		for (const id of duplicates(ids))
			problem(`display.measures repeats ${id}`);
		if (blank(display.label)) problem("display.label is empty");
		for (const measure of display.measures) {
			const { min, max } = measure.colorRange;
			if (!(min < max))
				problem(
					`display measure ${measure.id} has an empty colorRange`,
				);
			if (!(measure.legend.min < measure.legend.max))
				problem(`display measure ${measure.id} has an empty legend`);
		}
	}

	const headline = declaration.placeHeadline;
	if (headline) {
		if (headline.places.length === 0)
			problem("placeHeadline.places is empty");
		for (const key of ["label", "about"] as const)
			if (blank(headline[key])) problem(`placeHeadline.${key} is empty`);
	}

	const trend = declaration.placeTrend;
	if (trend) {
		if (trend.places.length === 0) problem("placeTrend.places is empty");
		for (const key of ["key", "label", "measure"] as const)
			if (blank(trend[key])) problem(`placeTrend.${key} is empty`);
		if (trend.roundTo !== undefined && !(trend.roundTo > 0))
			problem("placeTrend.roundTo is not above zero");
	}

	return problems;
}
