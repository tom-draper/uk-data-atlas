import type { DatabaseSync } from "node:sqlite";
import { assertNothingPassesAsPublished } from "../../conversion/storeConverted.ts";
import type { IdRegistries } from "../../ids/idRegistries.ts";

/**
 * The copy of the local notionals (`store.ts`) into `atlas.sqlite`, after
 * `copyNotionalSeries` made the model tables. Each model has one `modelled`
 * series per party, old ward release and new ward release:
 *
 *   local-election/party-votes/ward:2019-12-uk-bgc/party=con~notional-local-open:ward:2022-05-uk-bgc
 *
 * Each series derives from the published series of the old wards, and shares
 * its members. Its values are on the period of the election the old wards
 * were polled at. A ward made of whole old wards has `derived` values, any
 * other `estimated` ones with bounds.
 */

const ABOUT =
	"Notional local election votes by party on wards new at a boundary review, at the latest earlier election. Each old ward's votes are split between the new wards it overlaps by where its adult residents live, see docs/notional-elections.md.";

const sourceKey = (release: string, party: string) =>
	`local-election/party-votes/ward:${release}/party=${party}`;

export const localNotionalKey = (
	from: string,
	party: string,
	model: string,
	release: string,
) => `${sourceKey(from, party)}~${model}:ward:${release}`;

type ModelRow = {
	model: string;
	label: string;
	licence_id: string | null;
	bound_factor: number;
};

/**
 * Copies the local notional models into the database. Returns how many series
 * and observations it added. Fails if a series has no published source, or a
 * ward or period is missing, since the component was built from another base.
 */
export const copyLocalNotionalSeries = (
	database: DatabaseSync,
	ids: IdRegistries,
) => {
	const stale = (what: string) =>
		new Error(
			`The local notional estimates were made from another ${what}: rebuild notional-elections`,
		);
	const one = <T>(sql: string, ...params: (string | number)[]) =>
		database.prepare(sql).get(...params) as T | undefined;
	const missing = one<{ ward: string; release: string }>(
		`SELECT e.ward, e.release FROM notional_component.local_notional_estimate e
		WHERE NOT EXISTS (SELECT 1 FROM area_version v JOIN area a ON a.id = v.area_id
			JOIN area_releases r ON r.id = v.release_id
			WHERE r.geography = 'ward' AND r.release = e.release AND a.code = e.ward)
		LIMIT 1`,
	);
	if (missing)
		throw stale(`set of wards (${missing.ward} ${missing.release})`);

	const insertModel = database.prepare(
		"INSERT INTO model VALUES (?, ?, ?, ?, ?)",
	);
	const insertInputs = database.prepare(
		"INSERT INTO model_input SELECT model, role, key FROM notional_component.local_notional_input WHERE model = ?",
	);
	const insertSeries = database.prepare(
		"INSERT INTO series (id, dataset_id, measure_id, release_id, method, derived_from_id, key) VALUES (?, ?, ?, ?, 'modelled', ?, ?)",
	);
	const insertMembers = database.prepare(
		"INSERT INTO series_member (series_id, dimension_id, member_id) SELECT ?, dimension_id, member_id FROM series_member WHERE series_id = ?",
	);
	const insertSeriesModel = database.prepare(
		"INSERT INTO series_model VALUES (?, ?)",
	);
	// Derived (6) values are exact, so carry no bounds; estimated (2) ones do.
	const insertObservations = database.prepare(
		`INSERT INTO observation (series_id, area_version_id, period_id, value, status_id, lower, upper)
		SELECT ?, v.id, p.id, e.value,
			CASE e.status WHEN 'derived' THEN 6 ELSE 2 END,
			CASE e.status WHEN 'derived' THEN NULL ELSE e.lower END,
			CASE e.status WHEN 'derived' THEN NULL ELSE e.upper END
		FROM notional_component.local_notional_estimate e
		JOIN area a ON a.code = e.ward
		JOIN area_version v ON v.area_id = a.id AND v.release_id = ?
		JOIN period p ON p.label = e.period
		WHERE e.model = ? AND e.from_release = ? AND e.release = ? AND e.party = ?`,
	);
	const groups = database.prepare(
		`SELECT from_release, release, party, count(*) AS n
		FROM notional_component.local_notional_estimate WHERE model = ?
		GROUP BY from_release, release, party ORDER BY release, from_release, party`,
	);
	let series = 0;
	let observations = 0;
	for (const row of database
		.prepare(
			"SELECT * FROM notional_component.local_notional_model ORDER BY model",
		)
		.all() as ModelRow[]) {
		insertModel.run(
			row.model,
			row.label,
			row.licence_id,
			row.bound_factor,
			ABOUT,
		);
		insertInputs.run(row.model);
		for (const group of groups.all(row.model) as {
			from_release: string;
			release: string;
			party: string;
			n: number;
		}[]) {
			const source = one<{
				id: number;
				dataset_id: number;
				measure_id: number;
			}>(
				"SELECT id, dataset_id, measure_id FROM series WHERE key = ? AND method = 'published'",
				sourceKey(group.from_release, group.party),
			);
			if (!source)
				throw stale(
					`set of local series (no ${sourceKey(group.from_release, group.party)})`,
				);
			const release = one<{ id: number }>(
				"SELECT id FROM area_releases WHERE geography = 'ward' AND release = ?",
				group.release,
			)!;
			const key = localNotionalKey(
				group.from_release,
				group.party,
				row.model,
				group.release,
			);
			const id = ids.series.assign(key);
			insertSeries.run(
				id,
				source.dataset_id,
				source.measure_id,
				release.id,
				source.id,
				key,
			);
			insertMembers.run(id, source.id);
			insertSeriesModel.run(id, row.model);
			const added = Number(
				insertObservations.run(
					id,
					release.id,
					row.model,
					group.from_release,
					group.release,
					group.party,
				).changes,
			);
			if (added !== group.n) throw stale("set of election periods");
			observations += added;
			series += 1;
		}
	}
	assertNothingPassesAsPublished(database);
	return { series, observations };
};
