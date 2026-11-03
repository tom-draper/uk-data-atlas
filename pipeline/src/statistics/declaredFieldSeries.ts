import type { DatabaseSync } from "node:sqlite";
import {
	memberCode,
	STATISTICS_DATASETS,
	type DeclaredDataset,
	type DeclaredField,
	type DeclaredHeader,
	periods,
} from "@uk-data-atlas/atlas-runtime/catalogue";

/** The series and period a field of a compiled dataset holds, found from its declaration. */
export type FieldSeries = {
	measure: string;
	members: Record<string, string>;
	period: string;
};

/** The declaration of a dataset by its slug, such as `life-expectancy-series`. */
export const declaredDataset = (slug: string): DeclaredDataset | undefined =>
	STATISTICS_DATASETS.find(
		({ type }) =>
			type.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`) ===
			slug,
	);

/** Finds a dataset's declaration by its slug. */
export type DatasetLookup = (slug: string) => DeclaredDataset | undefined;

/**
 * The series and periods of a field path in a dataset, from the dataset's
 * declared fields. `partKey` names one part of the file, such as a year;
 * without it, every part is searched. A path no declared field maps, or a
 * dataset not declared, has none.
 */
export function declaredFieldSeries(
	database: DatabaseSync,
	slug: string,
	path: readonly string[],
	partKey?: string,
	lookup: DatasetLookup = declaredDataset,
): FieldSeries[] {
	const config = lookup(slug);
	if (!config) return [];
	const labels = database
		.prepare(
			`SELECT DISTINCT p.label FROM series s JOIN dataset d ON d.id = s.dataset_id
			JOIN observation o ON o.series_id = s.id JOIN period p ON p.id = o.period_id WHERE d.slug = ?`,
		)
		.all(slug)
		.map((row) => String(row.label));
	const memberCodeOf = (dimension: string, key: string) => {
		const declared = config.dimensions
			?.find((item) => item.slug === dimension)
			?.members?.find((member) => member.key === key);
		if (declared) return declared.code ?? memberCode(declared.key);
		// A member found in the data is labelled with its key.
		return database
			.prepare(
				`SELECT dm.code FROM dimension_member dm JOIN dimension d ON d.id = dm.dimension_id
				WHERE d.slug = ? AND dm.label = ?`,
			)
			.get(dimension, key)?.code as string | undefined;
	};
	const found: FieldSeries[] = [];
	const parts = config.payload
		? config.payload.parts(labels)
		: partKey === undefined
			? []
			: [{ key: partKey, header: {} }];
	for (const { key, header } of parts) {
		if (partKey !== undefined && key !== partKey) continue;
		const full = { ...header, data: null } as DeclaredHeader;
		const top = config.period
			? config.period(key, full).label
			: periods.year(Number(key)).label;
		const fields: DeclaredField[] =
			typeof config.fields === "function"
				? config.fields(key, full)
				: config.fields;
		for (const field of fields) {
			const pattern = field.path.split(".");
			if (pattern.length !== path.length) continue;
			const members: Record<string, string> = { ...field.members };
			let period = field.at?.label ?? top;
			let matches = true;
			for (const [index, segment] of pattern.entries()) {
				const binding = /^\{([a-z0-9-]+)\}$/.exec(segment)?.[1];
				if (!binding) {
					if (segment !== path[index]) matches = false;
				} else if (binding === "period") {
					period = (
						field.period ??
						(() => periods.year(Number(path[index])))
					)(path[index]!, full).label;
				} else {
					const code = memberCodeOf(binding, path[index]!);
					if (code === undefined) matches = false;
					// Named twice, the later binding is the member itself.
					else members[binding] = code;
				}
				if (!matches) break;
			}
			if (matches)
				found.push({ measure: field.measure, members, period });
		}
	}
	return found;
}
