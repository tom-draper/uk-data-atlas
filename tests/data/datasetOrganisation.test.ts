import { describe, expect, it } from "vitest";
import {
	DATASET_DECLARATIONS,
	DATASET_TOPICS,
	getDatasetTopic,
	isDatasetTopic,
	type DatasetTopic,
} from "@uk-data-atlas/datasets";
import { DATA_PAGES } from "@/lib/docs/content/data";
import { DATASET_GUIDES } from "@/lib/reference/datasets";
import { DATASETS } from "./datasetUniverse";

/**
 * Keeps the dataset organisation from drifting (docs/data-organisation.md,
 * task 3). The checks that a dataset has a registered topic, and that its
 * module follows from it, live in datasetTopics.test.ts and taxonomy.test.ts;
 * this file covers ids, topic membership and the lists that name datasets.
 * Source folders are checked in sourceDatasets.test.ts and, against the
 * built data/source tree, tests/built/data/sourceFolders.test.ts.
 *
 * Known exceptions sit in the allowlists below. Each says why and which task
 * removes it, so the allowlists only shrink.
 */

const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** A known exception: why it exists, and the task in the doc that removes it. */
interface Exception {
	reason: string;
	/** Task number in docs/data-organisation.md, or null when none owns it yet. */
	task: number | null;
}

/**
 * Topics allowed fewer than two datasets. Rule 5 asks for two datasets or a
 * planned second. Adding a second dataset makes the "stale" test fail until
 * the entry is deleted, so this list only shrinks.
 */
const THIN_TOPIC_ALLOWLIST: Record<string, Exception> = {
	"nhs-services": {
		reason: "Only nhs-waiting is built. GP, hospital and prescribing sources are in the unused set.",
		task: 18,
	},
	...Object.fromEntries(
		[
			"business",
			"public-finance",
			"planning",
			"homelessness",
			"qualifications",
			"crime-and-justice",
			"local-elections",
			"air-quality",
			"waste",
			"commuting",
			"road-safety",
		].map((topic) => [
			topic,
			{
				reason: "One dataset, and no task adds a second yet. Needs a second dataset or a product decision to fold the topic.",
				task: null,
			},
		]),
	),
};

/**
 * Datasets whose id is not kebab-case or not unique, which should not exist.
 * Empty today. Never add to it without a task that removes the entry.
 */
const ID_ALLOWLIST: Record<string, Exception> = {};

/**
 * Ids named by a docs page or a reference guide that the registry does not
 * build. Empty today. Never add to it without a task that removes the entry.
 */
const UNREGISTERED_ID_ALLOWLIST: Record<string, Exception> = {};

describe("dataset ids", () => {
	it("are kebab-case", () => {
		const bad = DATASETS.filter(
			({ id }) => !KEBAB_CASE.test(id) && !(id in ID_ALLOWLIST),
		).map(({ id }) => id);
		expect(bad).toEqual([]);
	});

	it("are unique across statistics, fuel poverty and census tables", () => {
		const seen = new Map<string, string>();
		const repeated: string[] = [];
		for (const { id, origin } of DATASETS) {
			if (seen.has(id) && !(id in ID_ALLOWLIST))
				repeated.push(`${id} (${seen.get(id)} and ${origin})`);
			seen.set(id, origin);
		}
		expect(repeated).toEqual([]);
	});

	it("include every declaration under the same id", () => {
		const ids = new Set(DATASETS.map(({ id }) => id));
		for (const declaration of DATASET_DECLARATIONS)
			expect(ids.has(declaration.id), declaration.id).toBe(true);
	});
});

describe("dataset topics", () => {
	it("hold at least two datasets each, unless allowlisted", () => {
		const count = new Map<string, number>();
		for (const { topic } of DATASETS)
			count.set(topic, (count.get(topic) ?? 0) + 1);
		const thin = DATASET_TOPICS.map(({ id }) => id).filter(
			(id) => (count.get(id) ?? 0) < 2 && !(id in THIN_TOPIC_ALLOWLIST),
		);
		expect(thin).toEqual([]);
	});

	it("drop their allowlist entry once they have two datasets", () => {
		const count = new Map<string, number>();
		for (const { topic } of DATASETS)
			count.set(topic, (count.get(topic) ?? 0) + 1);
		const stale = Object.keys(THIN_TOPIC_ALLOWLIST).filter(
			(id) => (count.get(id) ?? 0) >= 2,
		);
		expect(stale).toEqual([]);
	});

	it("only name topics that exist, with a theme", () => {
		for (const { id, topic } of DATASETS) {
			expect(isDatasetTopic(topic), id).toBe(true);
			expect(
				getDatasetTopic(topic as DatasetTopic).theme,
				id,
			).toBeTruthy();
		}
	});

	it("agree with each declaration's own topic", () => {
		for (const declaration of DATASET_DECLARATIONS) {
			const filed = DATASETS.find(({ id }) => id === declaration.id);
			expect(filed?.topic, declaration.id).toBe(declaration.topic);
		}
	});
});

describe("lists that name datasets", () => {
	const known = new Set(DATASETS.map(({ id }) => id));
	const unknown = (ids: string[]) =>
		ids.filter(
			(id) => !known.has(id) && !(id in UNREGISTERED_ID_ALLOWLIST),
		);

	it("have docs pages that only name registered datasets", () => {
		expect(unknown(DATA_PAGES.flatMap((page) => page.datasets))).toEqual(
			[],
		);
	});

	it("have reference guides that only describe registered datasets", () => {
		expect(unknown(Object.keys(DATASET_GUIDES))).toEqual([]);
	});

	it("keep every allowlisted unregistered id unregistered", () => {
		expect(
			Object.keys(UNREGISTERED_ID_ALLOWLIST).filter((id) =>
				known.has(id),
			),
		).toEqual([]);
	});
});
