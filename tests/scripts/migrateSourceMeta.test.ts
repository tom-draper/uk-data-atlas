import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, onTestFinished, test } from "vitest";
import { parseDatasetMeta } from "@uk-data-atlas/datasets";
import {
	DATASET_FOLDERS,
	metaAdditions,
	migrateMetaText,
	migrateSourceMeta,
	SUPPORT_FOLDERS,
} from "@/scripts/migrate-source-meta.mjs";
import { migrateMarker } from "@/scripts/migrate-source-layout.mjs";
import { DATASETS } from "../data/datasetUniverse";
import { DATASET_SOURCES, SUPPORT_SOURCES } from "../data/sourceDatasets";

const sha = (text: string) => createHash("sha256").update(text).digest("hex");

const write = (root: string, path: string, text: string) => {
	mkdirSync(dirname(join(root, path)), { recursive: true });
	writeFileSync(join(root, path), text);
};

const tree = () => {
	const root = mkdtempSync(join(tmpdir(), "source-meta-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	return root;
};

const body = {
	title: "Local election results 2025",
	publisher: "House of Commons Library",
	sourceUrl: "https://example.org/dataset",
	licence: { name: "Open Parliament Licence" },
	files: [{ path: "results.csv", role: "source" }],
};

/** A meta.json as the download wrote it, with topics after the description. */
const old = (id: string, extra = "") =>
	`{\n\t"id": "${id}",\n${extra}\t"title": "${body.title}",\n\t"topics": ["politics", "elections"],\n\t"publisher": "${body.publisher}",\n\t"sourceUrl": "${body.sourceUrl}",\n\t"licence": { "name": "Open Parliament Licence" },\n\t"files": [{ "path": "results.csv", "role": "source" }]\n}\n`;

const FOLDER = "politics/local-elections/local-election/2025";

test("names the dataset of every source folder the table lists, and only those", () => {
	expect(Object.keys(DATASET_FOLDERS).sort()).toEqual(
		DATASET_SOURCES.map(([folder]) => folder).sort(),
	);
	expect([...SUPPORT_FOLDERS].sort()).toEqual(
		Object.keys(SUPPORT_SOURCES).sort(),
	);
});

test("each folder names a registered dataset it feeds, the one it is named for when it feeds several", () => {
	const registered = new Set(DATASETS.map(({ id }) => id));
	for (const [folder, datasets] of DATASET_SOURCES) {
		const dataset = DATASET_FOLDERS[folder];
		expect(registered.has(dataset), folder).toBe(true);
		expect(datasets, folder).toContain(dataset);
		const named = datasets.find((id) => folder.split("/").includes(id));
		if (named) expect(dataset, folder).toBe(named);
	}
});

test("classifies a folder by where it sits", () => {
	expect(metaAdditions("boundaries/ons/2026-05-uk-bgc")).toEqual({});
	expect(metaAdditions("core/lookups/ons/wd-to-lad")).toEqual({});
	expect(metaAdditions("postcodes/onspd")).toEqual({});
	expect(metaAdditions("_staging/nhs/prescribing")).toEqual({
		kind: "staged",
	});
	expect(metaAdditions(SUPPORT_FOLDERS[0]!)).toEqual({ kind: "support" });
	expect(metaAdditions(FOLDER)).toEqual({ dataset: "local-election" });
	expect(metaAdditions("somewhere/new")).toBeNull();
});

test("drops topics and adds the dataset after the id, leaving the rest as it was", () => {
	const next = migrateMetaText(old("2025"), { dataset: "local-election" })!;
	expect(next).not.toContain("topics");
	expect(next).toBe(
		old("2025")
			.replace('\t"topics": ["politics", "elections"],\n', "")
			.replace(
				'"id": "2025",\n',
				'"id": "2025",\n\t"dataset": "local-election",\n',
			),
	);
	expect(parseDatasetMeta(JSON.parse(next), "2025").dataset).toBe(
		"local-election",
	);
});

test("handles topics over several lines, or as the last property", () => {
	const multi = old("2025").replace(
		'["politics", "elections"]',
		'[\n\t\t"politics",\n\t\t"elections"\n\t]',
	);
	expect(
		JSON.parse(migrateMetaText(multi, { dataset: "local-election" })!),
	).toEqual({ id: "2025", dataset: "local-election", ...body });

	const last = `{\n\t"id": "2025",\n\t"title": "t",\n\t"topics": ["a"]\n}\n`;
	expect(migrateMetaText(last, { kind: "staged" })).toBe(
		`{\n\t"id": "2025",\n\t"kind": "staged",\n\t"title": "t"\n}\n`,
	);
});

test("rewrites a file laid out unusually rather than leave it half done", () => {
	const text = `{"title":"t","id":"2025","topics":["a"]}`;
	const next = migrateMetaText(text, { dataset: "local-election" })!;
	expect(JSON.parse(next)).toEqual({
		title: "t",
		id: "2025",
		dataset: "local-election",
	});
});

test("leaves a migrated file alone, and refuses one that names another dataset", () => {
	const done = migrateMetaText(old("2025"), { dataset: "local-election" })!;
	expect(migrateMetaText(done, { dataset: "local-election" })).toBeNull();
	expect(() => migrateMetaText(done, { dataset: "population" })).toThrow(
		/has dataset "local-election", expected "population"/,
	);
});

test("migrates a tree, reports unknown folders, and is idempotent", async () => {
	const root = tree();
	write(root, `${FOLDER}/meta.json`, old("2025"));
	write(root, "_staging/nhs/prescribing/meta.json", old("prescribing"));
	write(
		root,
		"boundaries/ons/2026-05-uk-bgc/meta.json",
		old("2026-05-uk-bgc", '\t"kind": "boundary",\n'),
	);
	write(root, "somewhere/new/meta.json", old("new"));

	const dry = await migrateSourceMeta(root, { dryRun: true });
	expect(dry.rewrites).toHaveLength(3);
	expect(readFileSync(join(root, `${FOLDER}/meta.json`), "utf8")).toBe(
		old("2025"),
	);

	const result = await migrateSourceMeta(root);
	expect(result.rewrites.map(({ path }) => path).sort()).toEqual([
		"_staging/nhs/prescribing/meta.json",
		"boundaries/ons/2026-05-uk-bgc/meta.json",
		`${FOLDER}/meta.json`,
	]);
	expect(result.unknown).toEqual(["somewhere/new"]);
	expect(result.failed).toEqual([]);
	const read = (path: string) =>
		JSON.parse(readFileSync(join(root, path), "utf8"));
	expect(read(`${FOLDER}/meta.json`).dataset).toBe("local-election");
	expect(read("_staging/nhs/prescribing/meta.json").kind).toBe("staged");
	expect("topics" in read("boundaries/ons/2026-05-uk-bgc/meta.json")).toBe(
		false,
	);
	for (const [path, id] of [
		[`${FOLDER}/meta.json`, "2025"],
		["_staging/nhs/prescribing/meta.json", "prescribing"],
		["boundaries/ons/2026-05-uk-bgc/meta.json", "2026-05-uk-bgc"],
	] as const)
		expect(() => parseDatasetMeta(read(path), id), path).not.toThrow();

	expect((await migrateSourceMeta(root)).rewrites).toEqual([]);
});

test("the marker takes the new hash of a rewritten meta.json unless it was edited", async () => {
	const root = tree();
	const clean = `${FOLDER}/meta.json`;
	const edited = "_staging/nhs/prescribing/meta.json";
	write(root, clean, old("2025"));
	write(root, edited, old("prescribing"));
	const stamp = (path: string) => {
		const s = statSync(join(root, path));
		return { bytes: s.size, modifiedAt: s.mtimeMs, changedAt: s.ctimeMs };
	};
	writeFileSync(
		join(root, ".source-release.json"),
		JSON.stringify({
			version: 3,
			tag: "data-x",
			files: { [clean]: sha(old("2025")), [edited]: "release-hash" },
			fileStamps: { [clean]: stamp(clean), [edited]: stamp(edited) },
		}),
	);
	const { rewrites } = await migrateSourceMeta(root);
	expect(rewrites).toHaveLength(2);
	await migrateMarker(root, { rewrites });
	const marker = JSON.parse(
		readFileSync(join(root, ".source-release.json"), "utf8"),
	);
	expect(marker.files[clean]).toBe(
		sha(readFileSync(join(root, clean), "utf8")),
	);
	expect(marker.fileStamps[clean]).toEqual(stamp(clean));
	// Edited by hand since the release: the recorded hash stays, so it still differs.
	expect(marker.files[edited]).toBe("release-hash");
});
