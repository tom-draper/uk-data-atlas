import assert from "node:assert/strict";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test, { type TestContext } from "node:test";
import { readAtlasPayload } from "@uk-data-atlas/atlas-runtime/storage";
import { buildGeographyCatalogues } from "../../../pipeline/src/build-geography-catalogues";
import {
	buildArtifactPath,
	geographyCatalogues,
} from "@uk-data-atlas/atlas-runtime/areas";
import {
	readBoundaryRegistry,
	readGeographyInventory,
} from "@uk-data-atlas/atlas-runtime/areas";
import { readRelationshipPathInventory } from "@uk-data-atlas/atlas-runtime/relationships";
import {
	readAnalysisGeographyInventory,
	readAnalysisGeographyValidationInventory,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import { route } from "../src/routes";
import { testContext } from "./routeFixtures";
import {
	artifactDirectory,
	artifactRoot,
} from "@uk-data-atlas/atlas-runtime/storage";

const fixture = (t: TestContext) => {
	const root = mkdtempSync(join(tmpdir(), "geography-catalogues-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	mkdirSync(join(root, "data/build"), { recursive: true });
	mkdirSync(artifactDirectory(root), { recursive: true });
	const database = new DatabaseSync(join(root, "data/build/atlas.sqlite"));
	database.exec(
		"CREATE TABLE payloads (id TEXT PRIMARY KEY, payload TEXT NOT NULL) WITHOUT ROWID; INSERT INTO payloads VALUES ('dataset:existing', 'retained');",
	);
	database.close();
	for (const id of geographyCatalogues) {
		const path = buildArtifactPath(root, `${id}.json`);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(
			path,
			JSON.stringify(
				{
					schemaVersion: 1,
					contentHash: id,
					boundaryRegistryHash: "boundary-releases",
					releases: [],
					geographies: [],
					supports: [],
					paths: [],
					dataCatalogHash: "catalogue",
					crosswalkInventoryHash: "crosswalks",
					analysisGeographyInventoryHash: "analysis-geographies",
				},
				null,
				"\t",
			) + "\n",
		);
		writeFileSync(join(artifactDirectory(root), `${id}.json`), "obsolete");
	}
	return { root, apiRoot: join(root, "services/api") };
};

test("stores exact catalogue bytes, retains existing data and serves without compiler files", (t) => {
	const { root, apiRoot } = fixture(t);
	const expected = new Map(
		geographyCatalogues.map((id) => [
			id,
			readFileSync(buildArtifactPath(root, `${id}.json`), "utf8"),
		]),
	);
	buildGeographyCatalogues(root);
	buildGeographyCatalogues(root);
	for (const [id, payload] of expected) {
		assert.equal(readAtlasPayload(root, id), payload);
		assert.equal(
			existsSync(join(artifactRoot(apiRoot), `${id}.json`)),
			false,
		);
	}
	assert.equal(readAtlasPayload(root, "dataset:existing"), "retained");
	rmSync(join(root, "data/build/geography"), { recursive: true });
	assert.deepEqual(
		readBoundaryRegistry(apiRoot),
		JSON.parse(expected.get("boundary-releases")!),
	);
	assert.deepEqual(
		readGeographyInventory(apiRoot),
		JSON.parse(expected.get("geography-inventory")!),
	);
	const crosswalks = {
		schemaVersion: 1,
		contentHash: "crosswalks",
		crosswalks: [],
	} as const;
	const catalogue = {
		schemaVersion: 1,
		contentHash: "catalogue",
		source: {
			artifact: "data/datasets/dataset-manifest.json",
			manifestVersion: 1,
		},
		datasets: [],
		measures: [],
	} as const;
	const paths = readRelationshipPathInventory(apiRoot, {
		...crosswalks,
		crosswalks: [],
	});
	assert.deepEqual(paths, JSON.parse(expected.get("relationship-paths")!));
	const analysis = readAnalysisGeographyInventory(
		apiRoot,
		{ ...catalogue, datasets: [], measures: [] },
		{ ...crosswalks, crosswalks: [] },
	);
	assert.deepEqual(
		analysis,
		JSON.parse(expected.get("analysis-geographies")!),
	);
	assert.deepEqual(
		readAnalysisGeographyValidationInventory(
			apiRoot,
			analysis,
			{ ...catalogue, datasets: [], measures: [] },
			{ ...crosswalks, crosswalks: [] },
		),
		JSON.parse(expected.get("analysis-geography-validation")!),
	);
	assert.throws(
		() =>
			readRelationshipPathInventory(apiRoot, {
				...crosswalks,
				contentHash: "stale",
				crosswalks: [],
			}),
		/Invalid relationship/,
	);
	const body = expected.get("geography-inventory")!;
	const response = route(
		"GET",
		"/v1/documents/geography-inventory.json",
		testContext({
			documents: new Map([
				["geography-inventory", { body, contentHash: "sha256:test" }],
			]),
		}),
	);
	assert.equal(response.status, 200);
	assert.equal(response.representation?.body, body);
	assert.equal(response.representation?.contentHash, "sha256:test");
});

test("missing compiler inputs leave the database and old public files intact", (t) => {
	const { root, apiRoot } = fixture(t);
	const before = readFileSync(join(root, "data/build/atlas.sqlite"));
	rmSync(buildArtifactPath(root, "analysis-geographies.json"));
	assert.throws(() => buildGeographyCatalogues(root), /ENOENT/);
	assert.deepEqual(
		readFileSync(join(root, "data/build/atlas.sqlite")),
		before,
	);
	assert.equal(
		existsSync(join(artifactRoot(apiRoot), "boundary-releases.json")),
		true,
	);
	assert.equal(
		existsSync(join(root, "data/build/atlas.sqlite.geography.tmp")),
		false,
	);
});

test("a failed SQLite update keeps the previous database and removes its temporary copy", (t) => {
	const { root, apiRoot } = fixture(t);
	const path = join(root, "data/build/atlas.sqlite");
	const database = new DatabaseSync(path);
	database.exec(
		"CREATE TRIGGER reject_catalogue BEFORE INSERT ON payloads WHEN NEW.id = 'analysis-geographies' BEGIN SELECT RAISE(ABORT, 'rejected catalogue'); END;",
	);
	database.close();
	const before = readFileSync(path);
	assert.throws(() => buildGeographyCatalogues(root), /rejected catalogue/);
	assert.deepEqual(readFileSync(path), before);
	assert.equal(existsSync(`${path}.geography.tmp`), false);
	assert.equal(
		existsSync(join(artifactRoot(apiRoot), "boundary-releases.json")),
		true,
	);
});
