import type { DatabaseSync } from "node:sqlite";
import { assertNothingPassesAsPublished } from "../conversion/storeConverted.ts";
import type { IdRegistries } from "../ids/idRegistries.ts";
import { GENERAL_DAY, NEW_SEATS, OLD_SEATS } from "./inputs.ts";

/**
 * The copy of the notional component (`store.ts`), attached as
 * `notional_component`, into `atlas.sqlite`. Each shipped method becomes a
 * model, with one `modelled` series per party on the 2024 seats:
 *
 *   general-election/party-votes/constituency:2019-12-uk-bgc/party=con~notional-open:constituency:2024-07-uk-bgc
 *
 * - `model`: what the estimate is, the share-alike licence it carries (from
 *   an input, or NULL), and the factor its bounds are drawn with.
 * - `model_input`: the series keys and files it read. They are text, not
 *   `series_input` rows, since some (census counts, a source file) are not in
 *   the module that ships the estimate.
 * - `series_model`: the model each modelled series is from.
 *
 * Each series derives from the published 2019 series of its party, and shares
 * its members. A seat made of whole 2019 seats has `derived` values, exact
 * sums; any other has `estimated` values with lower and upper bounds.
 */

export const ATLAS_MODEL_SCHEMA = `
CREATE TABLE model (
	id TEXT PRIMARY KEY,
	label TEXT NOT NULL,
	licence_id TEXT,
	bound_factor REAL NOT NULL CHECK (bound_factor > 0),
	about TEXT NOT NULL) STRICT;
CREATE TABLE model_input (
	model_id TEXT NOT NULL REFERENCES model(id),
	role TEXT NOT NULL,
	key TEXT NOT NULL,
	PRIMARY KEY (model_id, role, key)) WITHOUT ROWID, STRICT;
CREATE TABLE series_model (
	series_id INTEGER PRIMARY KEY REFERENCES series(id),
	model_id TEXT NOT NULL REFERENCES model(id)) STRICT;
`;

const ABOUT =
	"Notional 2019 general election votes by party on the 2024 constituencies. Each 2019 seat's votes are split between the new seats it overlaps, by where its residents live and by ward local election results, see docs/notional-elections.md.";

const sourceKey = (party: string) =>
	`general-election/party-votes/constituency:${OLD_SEATS}/party=${party}`;

export const notionalKey = (party: string, model: string) =>
	`${sourceKey(party)}~${model}:constituency:${NEW_SEATS}`;

type ModelRow = {
	method: string;
	model: string;
	label: string;
	licence_id: string | null;
	bound_factor: number;
};

/**
 * Copies the notional models into the database. Returns how many series and
 * observations it added. Fails if a party has no published 2019 series or a
 * seat no 2024 area, since the component was built for another base.
 */
export const copyNotionalSeries = (
	database: DatabaseSync,
	ids: IdRegistries,
) => {
	database.exec(ATLAS_MODEL_SCHEMA);
	const stale = (what: string) =>
		new Error(
			`The notional estimates were made from another ${what}: rebuild notional-elections`,
		);
	const one = <T>(sql: string, ...params: (string | number)[]) =>
		database.prepare(sql).get(...params) as T | undefined;
	const release = one<{ id: number }>(
		"SELECT id FROM area_release WHERE geography = 'constituency' AND release = ?",
		NEW_SEATS,
	);
	const period = one<{ id: number }>(
		"SELECT id FROM period WHERE label = ?",
		GENERAL_DAY,
	);
	if (!release || !period) throw stale("set of releases and periods");
	const unplaced = one<{ n: number }>(
		`SELECT count(DISTINCT e.seat) AS n FROM notional_component.notional_estimate e
		WHERE e.method IN (SELECT method FROM notional_component.notional_model)
			AND NOT EXISTS (SELECT 1 FROM area_version v JOIN area a ON a.id = v.area_id
				WHERE v.release_id = ? AND a.code = e.seat)`,
		release.id,
	)!;
	if (unplaced.n > 0) throw stale("set of 2024 seats");

	const insertModel = database.prepare(
		"INSERT INTO model VALUES (?, ?, ?, ?, ?)",
	);
	const insertInputs = database.prepare(
		"INSERT INTO model_input SELECT ?, role, key FROM notional_component.notional_input WHERE method = ?",
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
		SELECT ?, v.id, ?, e.value,
			CASE e.status WHEN 'derived' THEN 6 ELSE 2 END,
			CASE e.status WHEN 'derived' THEN NULL ELSE e.lower END,
			CASE e.status WHEN 'derived' THEN NULL ELSE e.upper END
		FROM notional_component.notional_estimate e
		JOIN area a ON a.code = e.seat
		JOIN area_version v ON v.area_id = a.id AND v.release_id = ?
		WHERE e.method = ? AND e.party = ?`,
	);
	const parties = database.prepare(
		"SELECT DISTINCT party FROM notional_component.notional_estimate WHERE method = ? ORDER BY party",
	);
	let series = 0;
	let observations = 0;
	for (const row of database
		.prepare(
			"SELECT * FROM notional_component.notional_model ORDER BY model",
		)
		.all() as ModelRow[]) {
		insertModel.run(
			row.model,
			row.label,
			row.licence_id,
			row.bound_factor,
			ABOUT,
		);
		insertInputs.run(row.model, row.method);
		for (const { party } of parties.all(row.method) as {
			party: string;
		}[]) {
			const source = one<{
				id: number;
				dataset_id: number;
				measure_id: number;
			}>(
				"SELECT id, dataset_id, measure_id FROM series WHERE key = ? AND method = 'published'",
				sourceKey(party),
			);
			if (!source) throw stale(`set of 2019 series (no ${party})`);
			const key = notionalKey(party, row.model);
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
			observations += Number(
				insertObservations.run(
					id,
					period.id,
					release.id,
					row.method,
					party,
				).changes,
			);
			series += 1;
		}
	}
	assertNothingPassesAsPublished(database);
	return { series, observations };
};
