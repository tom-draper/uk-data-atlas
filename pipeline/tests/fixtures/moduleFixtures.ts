import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
	CORE_COMPATIBILITY_KEY,
	withModuleBuild,
	type ModuleManifest,
} from "@uk-data-atlas/datasets/registry";
import { manifestFilePath } from "../../src/modules/assembleModules";
import { buildModules } from "../../src/modules/buildModules";

/**
 * A small `atlas.sqlite` with the table layout the module build splits: core
 * tables, dataset tables for three modules and one add-on, postcode tables, one view over
 * core and one over a module. Only the columns the build touches are real; the
 * foreign keys are kept so the assembler's check has something to check.
 */
export const ATLAS_DDL = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE source (id INTEGER NOT NULL PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE area_release (id INTEGER NOT NULL PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE area_version (id INTEGER NOT NULL PRIMARY KEY, code TEXT NOT NULL);
CREATE TABLE area_hierarchy (child_version_id INTEGER NOT NULL REFERENCES area_version(id), parent_version_id INTEGER NOT NULL REFERENCES area_version(id), crosswalk_id INTEGER NOT NULL, accuracy TEXT NOT NULL, PRIMARY KEY(child_version_id, parent_version_id, crosswalk_id)) STRICT, WITHOUT ROWID;
CREATE INDEX area_hierarchy_parent ON area_hierarchy(parent_version_id, child_version_id);
CREATE TABLE place_location (place_id INTEGER PRIMARY KEY, longitude REAL) STRICT;
CREATE TABLE area_location (area_version_id INTEGER PRIMARY KEY REFERENCES area_version(id), longitude REAL) STRICT;
CREATE TABLE period (id INTEGER NOT NULL PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE status (id INTEGER NOT NULL PRIMARY KEY, slug TEXT NOT NULL UNIQUE, label TEXT NOT NULL);
CREATE TABLE party (id INTEGER NOT NULL PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE dimension (id INTEGER NOT NULL PRIMARY KEY, slug TEXT NOT NULL);
CREATE TABLE dimension_member (id INTEGER NOT NULL PRIMARY KEY, dimension_id INTEGER NOT NULL REFERENCES dimension(id), slug TEXT NOT NULL);
CREATE TABLE measure (id INTEGER NOT NULL PRIMARY KEY, slug TEXT NOT NULL UNIQUE, label TEXT NOT NULL);
CREATE TABLE dataset (id INTEGER NOT NULL PRIMARY KEY, slug TEXT NOT NULL UNIQUE, module TEXT NOT NULL, title TEXT NOT NULL, source_id INTEGER NOT NULL REFERENCES source(id));
CREATE TABLE series (id INTEGER NOT NULL PRIMARY KEY, dataset_id INTEGER NOT NULL REFERENCES dataset(id), measure_id INTEGER NOT NULL REFERENCES measure(id), release_id INTEGER NOT NULL REFERENCES area_release(id), derived_from_id INTEGER REFERENCES series(id), key TEXT NOT NULL UNIQUE);
CREATE TABLE series_member (series_id INTEGER NOT NULL REFERENCES series(id), dimension_id INTEGER NOT NULL REFERENCES dimension(id), member_id INTEGER NOT NULL REFERENCES dimension_member(id), PRIMARY KEY (series_id, dimension_id)) WITHOUT ROWID;
CREATE TABLE quantity (id INTEGER NOT NULL PRIMARY KEY, measure_id INTEGER NOT NULL REFERENCES measure(id), release_id INTEGER NOT NULL REFERENCES area_release(id), key TEXT NOT NULL UNIQUE);
CREATE TABLE series_preference (series_id INTEGER NOT NULL PRIMARY KEY REFERENCES series(id), quantity_id INTEGER NOT NULL REFERENCES quantity(id), rank INTEGER NOT NULL, UNIQUE (quantity_id, rank)) WITHOUT ROWID;
CREATE TABLE observation (series_id INTEGER NOT NULL REFERENCES series(id), area_version_id INTEGER NOT NULL REFERENCES area_version(id), period_id INTEGER NOT NULL REFERENCES period(id), value REAL, status_id INTEGER NOT NULL DEFAULT 1 REFERENCES status(id), lower REAL, upper REAL, PRIMARY KEY (series_id, area_version_id, period_id)) WITHOUT ROWID;
CREATE INDEX observation_area ON observation (area_version_id, period_id);
CREATE TABLE dataset_area_key (dataset_id INTEGER NOT NULL REFERENCES dataset(id), area_version_id INTEGER NOT NULL REFERENCES area_version(id), key TEXT NOT NULL, PRIMARY KEY (dataset_id, area_version_id)) WITHOUT ROWID;
CREATE TABLE area_identifier (dataset_id INTEGER NOT NULL REFERENCES dataset(id), area_version_id INTEGER NOT NULL REFERENCES area_version(id), scheme TEXT NOT NULL, identifier TEXT NOT NULL, PRIMARY KEY (dataset_id, area_version_id)) WITHOUT ROWID;
CREATE TABLE dataset_area_name (dataset_id INTEGER NOT NULL REFERENCES dataset(id), area_version_id INTEGER NOT NULL REFERENCES area_version(id), name TEXT NOT NULL, PRIMARY KEY (dataset_id, area_version_id)) WITHOUT ROWID;
CREATE TABLE series_input (series_id INTEGER NOT NULL REFERENCES series(id), input_series_id INTEGER NOT NULL REFERENCES series(id), role TEXT NOT NULL, PRIMARY KEY (series_id, input_series_id)) WITHOUT ROWID;
CREATE TABLE series_estimate (series_id INTEGER NOT NULL REFERENCES series(id), area_version_id INTEGER NOT NULL REFERENCES area_version(id), period_id INTEGER NOT NULL REFERENCES period(id), estimated_share REAL NOT NULL, PRIMARY KEY (series_id, area_version_id, period_id)) WITHOUT ROWID;
CREATE TABLE series_coverage (series_id INTEGER NOT NULL REFERENCES series(id), period_id INTEGER NOT NULL REFERENCES period(id), areas INTEGER NOT NULL, areas_with_value INTEGER NOT NULL, release_areas INTEGER NOT NULL, countries TEXT NOT NULL, PRIMARY KEY (series_id, period_id)) WITHOUT ROWID;
CREATE TABLE series_source (series_id INTEGER NOT NULL REFERENCES series(id), source_id INTEGER NOT NULL REFERENCES source(id), via TEXT NOT NULL, vias TEXT NOT NULL, depth INTEGER NOT NULL, PRIMARY KEY (series_id, source_id)) WITHOUT ROWID;
CREATE TABLE series_source_licence (series_id INTEGER NOT NULL REFERENCES series(id), source_id INTEGER NOT NULL REFERENCES source(id), licence_id TEXT NOT NULL, PRIMARY KEY (series_id, source_id, licence_id)) WITHOUT ROWID;
CREATE TABLE series_notice (series_id INTEGER NOT NULL REFERENCES series(id), source_id INTEGER NOT NULL REFERENCES source(id), notice TEXT NOT NULL, PRIMARY KEY (series_id, source_id, notice)) WITHOUT ROWID;
CREATE TABLE series_gap (series_id INTEGER NOT NULL REFERENCES series(id), area_version_id INTEGER NOT NULL REFERENCES area_version(id), period_id INTEGER NOT NULL REFERENCES period(id), reason TEXT NOT NULL, PRIMARY KEY (series_id, area_version_id, period_id)) WITHOUT ROWID;
CREATE TABLE conversion_skip (dataset_id INTEGER NOT NULL REFERENCES dataset(id), measure_id INTEGER NOT NULL REFERENCES measure(id), source_release_id INTEGER NOT NULL REFERENCES area_release(id), target_release_id INTEGER NOT NULL REFERENCES area_release(id), reason TEXT NOT NULL, series INTEGER NOT NULL, PRIMARY KEY (dataset_id, measure_id, source_release_id, target_release_id, reason)) WITHOUT ROWID;
CREATE TABLE weight_basis (id TEXT NOT NULL PRIMARY KEY, label TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE crosswalk (id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, from_release_id INTEGER NOT NULL REFERENCES area_release(id), to_release_id INTEGER NOT NULL REFERENCES area_release(id), basis_id TEXT REFERENCES weight_basis(id));
CREATE TABLE schema_table (name TEXT PRIMARY KEY);
CREATE TABLE schema_column (table_name TEXT REFERENCES schema_table(name), column_name TEXT);
CREATE TABLE crosswalk_edge_check (id INTEGER PRIMARY KEY, match TEXT);
CREATE INDEX crosswalk_check_match ON crosswalk_edge_check (match);
CREATE TABLE series_conversion (series_id INTEGER PRIMARY KEY REFERENCES series(id), rule TEXT NOT NULL, basis_id TEXT NOT NULL REFERENCES weight_basis(id), exact INTEGER NOT NULL);
CREATE TABLE series_crosswalk (series_id INTEGER NOT NULL REFERENCES series(id), position INTEGER NOT NULL, crosswalk_id INTEGER NOT NULL REFERENCES crosswalk(id), reversed INTEGER NOT NULL, PRIMARY KEY (series_id, position)) WITHOUT ROWID;
CREATE TABLE area_relationship (dataset_id INTEGER NOT NULL REFERENCES dataset(id), relation TEXT NOT NULL, period_id INTEGER NOT NULL REFERENCES period(id), child_version_id INTEGER NOT NULL REFERENCES area_version(id), parent_version_id INTEGER NOT NULL REFERENCES area_version(id), PRIMARY KEY (dataset_id, relation, period_id, child_version_id, parent_version_id)) WITHOUT ROWID;
CREATE TABLE election (id INTEGER NOT NULL PRIMARY KEY, dataset_id INTEGER NOT NULL REFERENCES dataset(id), label TEXT NOT NULL, date TEXT NOT NULL, release_id INTEGER NOT NULL REFERENCES area_release(id));
CREATE TABLE contest (id INTEGER NOT NULL PRIMARY KEY, election_id INTEGER NOT NULL REFERENCES election(id), area_version_id INTEGER NOT NULL REFERENCES area_version(id), winner_party_id INTEGER REFERENCES party(id));
CREATE TABLE candidacy (contest_id INTEGER NOT NULL REFERENCES contest(id), position INTEGER NOT NULL, family_name TEXT, PRIMARY KEY (contest_id, position)) WITHOUT ROWID;
CREATE TABLE model (id TEXT PRIMARY KEY, label TEXT NOT NULL, licence_id TEXT, bound_factor REAL NOT NULL, about TEXT NOT NULL) STRICT;
CREATE TABLE model_input (model_id TEXT NOT NULL REFERENCES model(id), role TEXT NOT NULL, key TEXT NOT NULL, PRIMARY KEY (model_id, role, key)) WITHOUT ROWID, STRICT;
CREATE TABLE series_model (series_id INTEGER PRIMARY KEY REFERENCES series(id), model_id TEXT NOT NULL REFERENCES model(id)) STRICT;
CREATE TABLE postcode_unit (id INTEGER NOT NULL PRIMARY KEY, postcode TEXT NOT NULL, area_version_id INTEGER NOT NULL REFERENCES area_version(id));
CREATE TABLE postcode (postcode TEXT PRIMARY KEY, latitude_microdegrees INTEGER, longitude_microdegrees INTEGER) WITHOUT ROWID;
CREATE INDEX postcode_unit_code ON postcode_unit (postcode);
CREATE VIEW area_label AS SELECT id, code FROM area_version;
CREATE VIEW observation_labelled AS SELECT o.series_id, a.code, m.slug AS measure, o.value FROM observation o JOIN area_version a ON a.id = o.area_version_id JOIN series s ON s.id = o.series_id JOIN measure m ON m.id = s.measure_id;
CREATE VIEW observation_totals AS SELECT measure, sum(value) AS total FROM observation_labelled GROUP BY measure;
`;

export const FIXTURE_MODULES = [
	"core",
	"economy",
	"health",
	"politics",
	"politics-sharealike",
	"postcodes",
	"crosswalk-checks",
] as const;

/** Writes the fixture atlas and returns the module of each dataset. */
export const writeFixtureAtlas = (path: string): void => {
	mkdirSync(dirname(path), { recursive: true });
	const database = new DatabaseSync(path);
	try {
		database.exec(ATLAS_DDL);
		database.exec(`
INSERT INTO meta VALUES ('release', 'fixture'), ('buildId', 'fixture-build'), ('schemaVersion', '4');
INSERT INTO schema_table VALUES ('crosswalk_edge_check'), ('crosswalk');
INSERT INTO schema_column VALUES ('crosswalk_edge_check', 'match'), ('crosswalk', 'id');
INSERT INTO crosswalk_edge_check VALUES (1, 'identical');
INSERT INTO source VALUES (1, 'ons');
INSERT INTO area_release VALUES (1, '2024');
INSERT INTO area_version VALUES (1, 'E01'), (2, 'E02'), (3, 'E03');
INSERT INTO area_location VALUES (1, -1.5);
INSERT INTO area_hierarchy VALUES (1, 2, 1, 'exact');
INSERT INTO place_location VALUES (1, -1.5);
INSERT INTO period VALUES (1, '2021'), (2, '2022'), (3, '2016-05-05'), (4, '2021-05-06');
INSERT INTO status VALUES (1, 'ok', 'Ok'), (2, 'suppressed', 'Suppressed');
INSERT INTO party VALUES (1, 'Alpha'), (2, 'Beta');
INSERT INTO dimension VALUES (1, 'sex');
INSERT INTO dimension_member VALUES (1, 1, 'female'), (2, 1, 'male');
INSERT INTO measure VALUES (1, 'population', 'Population'), (2, 'households', 'Households'), (3, 'income', 'Income'), (4, 'vacancies', 'Vacancies'), (5, 'vote-share', 'Vote share');
INSERT INTO dataset VALUES (1, 'income-estimates', 'economy', 'Income', 1), (2, 'jobs', 'economy', 'Jobs', 1), (3, 'census-health', 'health', 'Health', 1), (4, 'general-elections', 'politics', 'Elections', 1), (5, 'local-election', 'politics', 'Local elections', 1);
INSERT INTO series VALUES (1, 1, 1, 1, NULL, 's1'), (2, 1, 3, 1, NULL, 's2'), (3, 2, 4, 1, 1, 's3'), (4, 3, 1, 1, NULL, 's4'), (5, 3, 2, 1, NULL, 's5'), (6, 4, 5, 1, NULL, 's6'), (7, 5, 5, 1, NULL, 's7'), (8, 4, 5, 1, 6, 's8'), (9, 4, 5, 1, 6, 's9');
INSERT INTO series_member VALUES (4, 1, 1), (2, 1, 2);
INSERT INTO quantity VALUES (1, 1, 1, 'population/r1'), (2, 3, 1, 'income/r1/sex=male'), (3, 4, 1, 'vacancies/r1'), (4, 2, 1, 'households/r1'), (5, 5, 1, 'vote-share/r1');
INSERT INTO series_preference VALUES (1, 1, 1), (4, 1, 2), (2, 2, 1), (3, 3, 1), (5, 4, 1), (6, 5, 1), (7, 5, 2), (8, 5, 3), (9, 5, 4);
INSERT INTO observation VALUES
  (1, 1, 1, 100, 1, NULL, NULL), (1, 2, 1, 200, 1, NULL, NULL), (1, 3, 1, NULL, 2, NULL, NULL),
  (2, 1, 1, 30.5, 1, 29, 32), (2, 2, 1, 41, 1, NULL, NULL),
  (3, 1, 2, 7, 1, NULL, NULL),
  (4, 1, 1, 60, 1, NULL, NULL), (4, 2, 2, 80, 1, NULL, NULL),
  (5, 1, 1, 40, 1, NULL, NULL),
  (6, 1, 1, 55, 1, NULL, NULL),
  (7, 1, 3, 10, 1, NULL, NULL), (7, 2, 3, 12, 1, NULL, NULL), (7, 1, 4, 20, 1, NULL, NULL),
  (8, 1, 1, 50, 1, 45, 55), (8, 2, 1, 5, 1, NULL, NULL),
  (9, 1, 1, 52, 1, 46, 58);
INSERT INTO model VALUES ('notional-sharealike', 'Share-alike', 'cc-by-sa-3.0', 0.32, 'About'), ('notional-open', 'Open', NULL, 0.38, 'About');
INSERT INTO model_input VALUES ('notional-sharealike', 'local', 's7'), ('notional-open', 'general', 's6');
INSERT INTO series_model VALUES (8, 'notional-sharealike'), (9, 'notional-open');
INSERT INTO dataset_area_key VALUES (1, 1, 'k1'), (3, 2, 'k2');
INSERT INTO area_identifier VALUES (1, 1, 'example', 'k1');
INSERT INTO dataset_area_name VALUES (1, 1, 'One'), (4, 2, 'Two');
INSERT INTO series_input VALUES (3, 1, 'value');
INSERT INTO series_estimate VALUES (7, 1, 3, 0.5), (7, 1, 4, 0.25);
INSERT INTO series_source VALUES (1, 1, 'dataset', 'dataset', 0), (2, 1, 'dataset', 'dataset', 0), (3, 1, 'dataset', 'dataset, input:value', 0), (4, 1, 'dataset', 'dataset', 0), (5, 1, 'dataset', 'dataset', 0), (6, 1, 'dataset', 'dataset', 0), (7, 1, 'dataset', 'dataset', 0), (8, 1, 'dataset', 'dataset, model-input', 0), (9, 1, 'dataset', 'dataset, model-input', 0);
INSERT INTO series_source_licence VALUES (1, 1, 'ogl-3.0'), (7, 1, 'cc-by-sa-3.0');
INSERT INTO series_notice VALUES (1, 1, 'Contains OS data');
INSERT INTO series_coverage VALUES (1, 1, 3, 2, 3, 'E'), (2, 1, 2, 2, 3, 'E'), (3, 2, 1, 1, 3, 'E'), (4, 1, 1, 1, 3, 'E'), (4, 2, 1, 1, 3, 'E'), (5, 1, 1, 1, 3, 'E'), (6, 1, 1, 1, 3, 'E'), (7, 3, 2, 2, 3, 'E'), (7, 4, 1, 1, 3, 'E'), (8, 1, 2, 2, 3, 'E'), (9, 1, 1, 1, 3, 'E');
INSERT INTO series_gap VALUES (1, 3, 1, 'suppressed'), (4, 2, 2, 'missing'), (7, 3, 3, 'missing'), (7, 3, 4, 'missing');
INSERT INTO conversion_skip VALUES (1, 1, 1, 1, 'no-route', 2), (3, 2, 1, 1, 'no-values', 1);
INSERT INTO weight_basis VALUES ('pop', 'Population');
INSERT INTO crosswalk VALUES (1, 'x', 1, 1, 'pop');
INSERT INTO series_conversion VALUES (1, 'sum', 'pop', 1), (4, 'rebuild', 'pop', 0);
INSERT INTO series_crosswalk VALUES (1, 1, 1, 0), (4, 1, 1, 1);
INSERT INTO area_relationship VALUES (1, 'parent', 1, 1, 2), (3, 'parent', 1, 2, 3), (5, 'parent', 3, 1, 2), (5, 'parent', 4, 1, 2);
INSERT INTO election VALUES (1, 4, 'GE 2024', '2024-07-04', 1), (2, 5, 'Local 2016', '2016-05-05', 1), (3, 5, 'Local 2021', '2021-05-06', 1);
INSERT INTO contest VALUES (1, 1, 1, 1), (2, 1, 2, 2), (3, 2, 1, 1), (4, 3, 2, 2);
INSERT INTO candidacy VALUES (1, 1, 'Smith'), (1, 2, 'Jones'), (2, 1, 'Khan'), (3, 1, 'Cooper'), (4, 1, 'Dean');
INSERT INTO postcode_unit VALUES (1, 'AA1 1AA', 1), (2, 'AA1 1AB', 2);
INSERT INTO postcode VALUES ('AA11AA', 51500000, -120000);
`);
	} finally {
		database.close();
	}
};

/** Registry manifests for the fixture modules, with `politics-sharealike` an add-on to `politics`. */
export const fixtureManifests = (): ModuleManifest[] => {
	const datasets: Record<string, Array<[string, string, boolean]>> = {
		economy: [
			["income-estimates", "Income", false],
			["jobs", "Jobs", false],
		],
		health: [["census-health", "Health", false]],
		politics: [
			["general-elections", "Elections", false],
			["local-election", "Local elections", false],
		],
		"politics-sharealike": [["local-election", "Local elections", true]],
	};
	const licence = (id: string) =>
		id === "politics-sharealike" ? "cc-by-sa-4.0" : "ogl-3.0";
	return FIXTURE_MODULES.map((id): ModuleManifest => {
		const theme = id in datasets;
		return {
			id,
			kind: theme ? "theme" : "foundation",
			label: id,
			description: `The ${id} module.`,
			alwaysIncluded: id === "core",
			datasets: (datasets[id] ?? []).map(([dataset, title, partial]) => ({
				id: dataset,
				title,
				topic: id,
				partial,
				licences: [{ id: licence(id) }],
			})),
			requires:
				id === "politics-sharealike"
					? ["politics"]
					: id === "crosswalk-checks"
						? ["core"]
						: [],
			addOns: id === "politics" ? ["politics-sharealike"] : [],
			licences: [{ id: licence(id) }],
			licenceConflict: null,
			unresolvedLicences: [],
			compatibility: { core: CORE_COMPATIBILITY_KEY },
			build: { status: "not-built", bytes: null, files: null },
		} as unknown as ModuleManifest;
	});
};

/**
 * Builds the fixture atlas into a release tree under `root` and writes the
 * manifests beside each file, as `data:dist` does. Returns the manifests.
 */
export const buildFixtureRelease = async (
	root: string,
	{ coreKey = CORE_COMPATIBILITY_KEY }: { coreKey?: string } = {},
): Promise<ModuleManifest[]> => {
	const atlas = join(root, "atlas.sqlite");
	writeFixtureAtlas(atlas);
	const release = join(root, "release");
	const manifests = fixtureManifests();
	const builds = await buildModules({
		atlasPath: atlas,
		outDir: release,
		manifests,
	});
	const built = manifests
		.filter((manifest) => manifest.id in builds)
		.map((manifest) => withModuleBuild(manifest, builds[manifest.id]!));
	for (const manifest of built) {
		const path = join(release, manifestFilePath(manifest.id));
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(
			path,
			JSON.stringify({
				release: "fixture",
				...manifest,
				compatibility: { core: coreKey },
			}),
		);
	}
	return built;
};
