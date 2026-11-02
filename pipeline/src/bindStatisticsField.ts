import type { DatabaseSync } from "node:sqlite";
import {
	memberCode,
	type DeclaredDataset,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import type { CompiledMeasure } from "./catalog/manifest";
import {
	hashStatisticsSelection,
	type StatisticsSelection,
} from "./statisticsExport";

type Field = NonNullable<CompiledMeasure["statisticsField"]>;

const equivalentUnits: Record<string, string> = {
	"% of premises": "percent of premises",
	"reported collisions": "collisions",
	"µg/m³": "micrograms per cubic metre",
	"£ thousand": "gbp thousand",
	"£": "gbp",
	"£ per year": "gbp per year",
	"£ per hour": "gbp per hour",
};

/** Resolve a source field only when its canonical rows reproduce the published records. */
export function bindStatisticsField(
	database: DatabaseSync,
	field: Field,
	unit: string,
	config?: DeclaredDataset,
): StatisticsSelection[] | undefined {
	const units = JSON.stringify([unit, equivalentUnits[unit] ?? unit]);
	const leaves = database
		.prepare(
			`SELECT DISTINCT r.id AS release, p.label AS period
		FROM dataset_leaf leaf
		JOIN dataset d ON d.id = leaf.dataset_id
		JOIN dataset_part part ON part.dataset_id = leaf.dataset_id AND part.position = leaf.part
		JOIN series s ON s.id = leaf.series_id
		JOIN measure m ON m.id = s.measure_id
		JOIN area_releases r ON r.position = s.release_id
		JOIN period p ON p.id = leaf.period_id
		WHERE d.slug = ? AND part.key = ? AND leaf.records = ? AND leaf.path = ?
		AND leaf.kind = 'value' AND r.geography = ? AND p.label = ? AND m.unit IN (SELECT value FROM json_each(?))
		ORDER BY r.id, p.label`,
		)
		.all(
			field.dataset,
			field.sourcePeriod,
			field.records,
			JSON.stringify(field.field.split(".")),
			field.geography,
			field.publishedPeriod,
			units,
		);
	let selection: StatisticsSelection[] = leaves.map((row) => ({
		dataset: field.dataset,
		path: field.field.split("."),
		geography: field.geography,
		release: String(row.release),
		periods: [String(row.period)],
	}));
	if (selection.length === 0 && config && Array.isArray(config.fields)) {
		const parts = field.field.split(".");
		for (const candidate of config.fields) {
			const pattern = candidate.path.split(".");
			if (pattern.length !== parts.length) continue;
			const members: Record<string, string> = {};
			let matches = true;
			for (const [dimension, key] of Object.entries(
				candidate.members ?? {},
			)) {
				const member = config.dimensions
					?.find((item) => item.slug === dimension)
					?.members?.find((item) => item.key === key);
				if (!member) {
					matches = false;
					break;
				}
				members[dimension] = member.code ?? memberCode(member.key);
			}
			for (const [index, segment] of pattern.entries()) {
				const dimension = /^\{([^}]+)\}$/.exec(segment)?.[1];
				if (!dimension) {
					if (segment !== parts[index]) matches = false;
					continue;
				}
				const member = config.dimensions
					?.find((item) => item.slug === dimension)
					?.members?.find((item) => item.key === parts[index]);
				if (!member || members[dimension]) {
					matches = false;
					break;
				}
				members[dimension] = member.code ?? memberCode(member.key);
			}
			if (!matches || !Object.keys(members).length) continue;
			const rows = database
				.prepare(
					`SELECT DISTINCT r.id AS release, p.label AS period
				FROM series s JOIN dataset d ON d.id = s.dataset_id
				JOIN measure m ON m.id = s.measure_id
				JOIN area_releases r ON r.position = s.release_id
				JOIN observation o ON o.series_id = s.id
				JOIN period p ON p.id = o.period_id
				WHERE d.slug = ? AND m.slug = ? AND m.unit IN (SELECT value FROM json_each(?)) AND r.geography = ?
				AND p.label = ? AND NOT EXISTS (
					SELECT 1 FROM json_each(?) expected WHERE NOT EXISTS (
						SELECT 1 FROM series_member sm JOIN dimension dim ON dim.id = sm.dimension_id
						JOIN dimension_member dm ON dm.id = sm.member_id
						WHERE sm.series_id = s.id AND dim.slug = expected.key AND dm.code = expected.value
					)
				) ORDER BY r.id, p.label`,
				)
				.all(
					field.dataset,
					candidate.measure,
					units,
					field.geography,
					field.publishedPeriod,
					JSON.stringify(members),
				);
			selection.push(
				...rows.map((row) => ({
					dataset: field.dataset,
					measure: candidate.measure,
					members,
					geography: field.geography,
					release: String(row.release),
					periods: [String(row.period)],
				})),
			);
		}
	}
	if (!selection.length) return undefined;
	const actual = hashStatisticsSelection(database, selection);
	return actual.recordCount === field.recordCount &&
		actual.recordHash === field.recordHash
		? selection
		: undefined;
}
