import type { SQLOutputValue, SqlReader } from "@uk-data-atlas/atlas-db";
import type { ReleaseSeriesSpec } from "./releaseSeries.ts";

/**
 * The change between periods of one area on fixed boundaries, as
 * `v_area_period_change` in `atlas.sqlite` holds it (docs/database-roadmap.md,
 * task 44). Nothing is computed here: each row is read as the build wrote it.
 */

export type AreaPeriodChange = {
	from: string;
	to: string;
	/** `adjacent` periods, or the first and the latest. */
	span: "adjacent" | "first-latest";
	fromValue: number;
	toValue: number;
	change: number;
	/** Null where the start is zero or the measure is itself a percentage. */
	percentChange: number | null;
	fromAccuracy: string;
	toAccuracy: string;
	/** The worse of the two. */
	accuracy: string;
	/** Whether the change as published could be set beside this one, and if not why. */
	boundaryCheck: string;
	/** The change between the values published for the area's code at each end. */
	publishedChange: number | null;
	/** Published change minus the change on fixed boundaries. */
	boundaryEffect: number | null;
	/** Whether the area's boundary moved materially between the two ends. */
	materiallyChanged: boolean | null;
	residentsLost: number | null;
	residentsGained: number | null;
	landLost: number | null;
	landGained: number | null;
	fromDataset: string;
	toDataset: string;
	sourceChanged: boolean;
	periodKindChanged: boolean;
	periodsOverlap: boolean;
	/** Declared method breaks the change crosses or touches, as `kind period; ...`. */
	breaks: string | null;
	breakNotes: string | null;
};

export type AreaPeriodChanges = {
	/** The quantity the changes are of (`quantity.key`). */
	quantity: string;
	changes: AreaPeriodChange[];
};

const num = (value: SQLOutputValue) => (value === null ? null : Number(value));
const flag = (value: SQLOutputValue) => (value === null ? null : value === 1);
const text = (value: SQLOutputValue) => (value === null ? null : String(value));

/**
 * The quantity a spec reads on a release, keyed as the build keys it: the
 * measure, the release and the member of each qualifier dimension. A part
 * reads a quantity only at the total of every breakdown dimension, fixed at
 * its default member or summed over its parts. Undefined for a ratio, a
 * part of a total, or parts that name different quantities.
 */
const quantityOf = (
	database: SqlReader,
	spec: ReleaseSeriesSpec,
	release: { id: number; key: string },
) => {
	if (spec.ratio) return;
	const roles = database.prepare(
		`SELECT d.slug AS dimension, md.role, dm.code AS total FROM measure_dimension md
		JOIN measure m ON m.id = md.measure_id JOIN dimension d ON d.id = md.dimension_id
		LEFT JOIN dimension_member dm ON dm.id = md.default_member_id
		WHERE m.slug = ?`,
	);
	const keys = new Set<string | undefined>();
	for (const part of spec.parts) {
		const role = new Map(
			roles
				.all(part.measure)
				.map((row) => [
					String(row.dimension),
					{ role: String(row.role), total: text(row.total) },
				]),
		);
		const summed = new Set(part.sum ?? []);
		const qualifiers: string[] = [];
		let total = true;
		for (const dimension of summed)
			if (role.get(dimension)?.role !== "breakdown") total = false;
		for (const [dimension, code] of Object.entries(part.dimensions)) {
			const held = role.get(dimension);
			if (held?.role === "qualifier")
				qualifiers.push(`${dimension}=${code}`);
			else if (held?.total !== code) total = false;
		}
		keys.add(
			total
				? [part.measure, release.key, ...qualifiers.sort()].join("/")
				: undefined,
		);
	}
	const [key] = keys;
	if (keys.size !== 1 || !key) return;
	return database
		.prepare("SELECT 1 FROM quantity WHERE key = ? AND release_id = ?")
		.get(key, release.id)
		? key
		: undefined;
};

/**
 * An area's changes on a release for the quantity a spec reads, adjacent
 * pairs first in period order, then first to latest. Undefined where the
 * database has no `v_area_period_change` (one built before task 44) or the
 * spec reads no single quantity.
 */
export const readAreaPeriodChanges = (
	database: SqlReader,
	spec: ReleaseSeriesSpec,
	target: { geography: string; release: string },
	areaCode: string,
	periodLabel: (stored: string) => string = (stored) => stored,
): AreaPeriodChanges | undefined => {
	if (
		!database
			.prepare(
				"SELECT 1 FROM sqlite_schema WHERE type = 'view' AND name = 'v_area_period_change'",
			)
			.get()
	)
		return undefined;
	const release = database
		.prepare(
			"SELECT id FROM area_release WHERE geography = ? AND release = ?",
		)
		.get(target.geography, target.release);
	if (!release) return undefined;
	const quantity = quantityOf(database, spec, {
		id: Number(release.id),
		key: `${target.geography}:${target.release}`,
	});
	if (!quantity) return undefined;
	const rows = database
		.prepare(
			`SELECT c.* FROM v_area_period_change c
			JOIN period p ON p.id = c.from_period_id
			WHERE c.quantity = ? AND c.area_code = ?
			ORDER BY c.span = 'first-latest', p.start_date, c.from_period_id`,
		)
		.all(quantity, areaCode);
	return {
		quantity,
		changes: rows.map((row) => ({
			from: periodLabel(String(row.from_period)),
			to: periodLabel(String(row.to_period)),
			span: row.span === "adjacent" ? "adjacent" : "first-latest",
			fromValue: Number(row.from_value),
			toValue: Number(row.to_value),
			change: Number(row.change),
			percentChange: num(row.percent_change),
			fromAccuracy: String(row.from_accuracy),
			toAccuracy: String(row.to_accuracy),
			accuracy: String(row.accuracy),
			boundaryCheck: String(row.boundary_check),
			publishedChange: num(row.published_change),
			boundaryEffect: num(row.boundary_effect),
			materiallyChanged: flag(row.materially_changed),
			residentsLost: num(row.residents_lost),
			residentsGained: num(row.residents_gained),
			landLost: num(row.land_lost),
			landGained: num(row.land_gained),
			fromDataset: String(row.from_dataset),
			toDataset: String(row.to_dataset),
			sourceChanged: row.source_changed === 1,
			periodKindChanged: row.period_kind_changed === 1,
			periodsOverlap: row.periods_overlap === 1,
			breaks: text(row.breaks),
			breakNotes: text(row.break_notes),
		})),
	};
};
