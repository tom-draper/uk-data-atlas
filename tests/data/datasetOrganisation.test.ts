import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	DATASET_DECLARATIONS,
	DATASET_GUIDES as REGISTRY_GUIDES,
	DATASET_THEMES,
	DATASET_TOPICS,
	DATASET_TREE,
	REGISTERED_DATASETS,
	getDatasetTopic,
	isDatasetTopic,
	themeOfTopic,
	type DatasetTopic,
} from "@uk-data-atlas/datasets";
import {
	DATASET_HOME_MODULE_IDS,
	DATASET_SPLIT_MODULES,
	isDatasetModule,
	moduleOfDataset,
} from "@uk-data-atlas/datasets/registry";
import { DATASETS } from "./datasetUniverse";

/**
 * Keeps the dataset organisation from drifting (docs/data-organisation.md,
 * task 3). The checks that a dataset has a registered topic, and that its
 * module follows from it, live in datasetTopics.test.ts and taxonomy.test.ts;
 * this file covers ids, topic membership and the registry's guides and tree.
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
		reason: "Only nhs-waiting is built. The GP, hospital and prescribing sources are staged in _staging/; promoting one adds the second dataset.",
		task: null,
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
			"economic-output",
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

describe("declaration folders", () => {
	const SOURCE = join(process.cwd(), "packages/datasets/src");
	const folders = (path: string) =>
		readdirSync(path, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name);

	it("sit at <theme>/<topic>/<id> for the declared theme, topic and id", () => {
		for (const { id, topic } of DATASET_DECLARATIONS) {
			const path = join(
				SOURCE,
				themeOfTopic(topic),
				topic,
				id,
				"dataset.ts",
			);
			expect(existsSync(path), `${id} should be in ${path}`).toBe(true);
		}
	});

	it("hold no dataset.ts that is not a declaration", () => {
		const declared = new Set(
			DATASET_DECLARATIONS.map(
				({ id, topic }) => `${themeOfTopic(topic)}/${topic}/${id}`,
			),
		);
		const found: string[] = [];
		for (const theme of folders(SOURCE))
			for (const topic of folders(join(SOURCE, theme)))
				for (const id of folders(join(SOURCE, theme, topic)))
					if (
						existsSync(join(SOURCE, theme, topic, id, "dataset.ts"))
					)
						found.push(`${theme}/${topic}/${id}`);
		expect(found.sort()).toEqual([...declared].sort());
	});
});

describe("registry guides", () => {
	it("describe every dataset, under the topic it is filed in", () => {
		for (const { id, topic } of DATASETS) {
			expect(REGISTRY_GUIDES[id]?.about, id).toBeTruthy();
			expect(REGISTRY_GUIDES[id]?.topic, id).toBe(topic);
		}
	});

	it("list the same related topics as the dataset, in registry order", () => {
		const order = DATASET_TOPICS.map(({ id }) => id);
		for (const { id, related } of DATASETS) {
			const guided = REGISTRY_GUIDES[id]?.related ?? [];
			expect([...guided].sort(), id).toEqual([...related].sort());
			expect(
				guided.map((topic) => order.indexOf(topic)),
				`${id}: related topics in registry order`,
			).toEqual(
				guided
					.map((topic) => order.indexOf(topic))
					.sort((a, b) => a - b),
			);
		}
	});

	it("title every dataset, without repeating a title within a topic", () => {
		const seen = new Set<string>();
		for (const { id, topic } of DATASETS) {
			const title = REGISTRY_GUIDES[id]?.title;
			expect(title, id).toBeTruthy();
			expect(seen.has(`${topic}/${title}`), `${id}: ${title}`).toBe(
				false,
			);
			seen.add(`${topic}/${title}`);
		}
	});

	it("only describe registered datasets", () => {
		const known = new Set(DATASETS.map(({ id }) => id));
		expect(
			Object.keys(REGISTRY_GUIDES).filter((id) => !known.has(id)),
		).toEqual([]);
	});
});

describe("dataset tree", () => {
	it("lists themes and topics in registry order, each topic with a dataset", () => {
		expect(DATASET_TREE.map(({ theme }) => theme.id)).toEqual(
			DATASET_THEMES.map(({ id }) => id),
		);
		expect(
			DATASET_TREE.flatMap(({ topics }) => topics.map((t) => t.topic.id)),
		).toEqual(DATASET_TOPICS.map(({ id }) => id));
		for (const { topics } of DATASET_TREE)
			for (const { topic, datasets } of topics)
				expect(datasets.length, topic.id).toBeGreaterThan(0);
	});

	it("holds every dataset exactly once", () => {
		expect(REGISTERED_DATASETS.map(({ id }) => id).sort()).toEqual(
			DATASETS.map(({ id }) => id).sort(),
		);
	});
});

describe("related topics", () => {
	it("never change where a dataset is filed", () => {
		for (const dataset of REGISTERED_DATASETS) {
			const branches = DATASET_TREE.flatMap(({ topics }) => topics);
			const primary = branches.filter(({ datasets }) =>
				datasets.some(({ id }) => id === dataset.id),
			);
			expect(
				primary.map(({ topic }) => topic.id),
				dataset.id,
			).toEqual([dataset.topic]);
		}
	});

	it("list a dataset under each related topic, apart from its own", () => {
		const branches = DATASET_TREE.flatMap(({ topics }) => topics);
		for (const dataset of REGISTERED_DATASETS) {
			const listed = branches
				.filter(({ related }) =>
					related.some(({ id }) => id === dataset.id),
				)
				.map(({ topic }) => topic.id);
			expect(listed, dataset.id).toEqual(
				DATASET_TOPICS.map(({ id }) => id).filter((id) =>
					dataset.related?.includes(id),
				),
			);
		}
	});

	it("hold few datasets, so the secondary lists stay short", () => {
		const related = REGISTERED_DATASETS.filter(
			({ related }) => (related?.length ?? 0) > 0,
		);
		expect(related.length).toBeLessThanOrEqual(12);
		for (const dataset of related)
			expect(dataset.related!.length, dataset.id).toBeLessThanOrEqual(2);
	});
});

describe("split modules", () => {
	const registered = new Map(
		REGISTERED_DATASETS.map((dataset) => [dataset.id, dataset]),
	);

	it("only name registered datasets, under the theme they are split from", () => {
		for (const split of DATASET_SPLIT_MODULES) {
			expect(split.datasets.length, split.id).toBeGreaterThan(0);
			for (const id of split.datasets) {
				const dataset = registered.get(id);
				expect(dataset, `${split.id}: ${id}`).toBeDefined();
				expect(dataset!.theme, `${split.id}: ${id}`).toBe(split.theme);
			}
		}
	});

	it("give every dataset exactly one home module", () => {
		const homes = new Map<string, string[]>();
		for (const dataset of REGISTERED_DATASETS) {
			const home = moduleOfDataset(dataset);
			expect(DATASET_HOME_MODULE_IDS, dataset.id).toContain(home);
			homes.set(home, [...(homes.get(home) ?? []), dataset.id]);
		}
		for (const split of DATASET_SPLIT_MODULES) {
			const held = homes.get(split.id) ?? [];
			if (split.holds === "datasets")
				expect(held.sort(), split.id).toEqual(
					[...split.datasets].sort(),
				);
			else expect(held, `${split.id} is an add-on`).toEqual([]);
		}
	});

	it("make add-ons require a module that homes their datasets", () => {
		for (const split of DATASET_SPLIT_MODULES) {
			if (split.holds !== "licensed-rows") {
				expect(split.requires, split.id).toEqual([]);
				continue;
			}
			expect(split.requires.length, split.id).toBeGreaterThan(0);
			for (const required of split.requires) {
				expect(
					isDatasetModule(required),
					`${split.id} -> ${required}`,
				).toBe(true);
				expect(DATASET_HOME_MODULE_IDS).toContain(required);
			}
			for (const id of split.datasets)
				expect(split.requires, `${split.id}: ${id}`).toContain(
					moduleOfDataset(registered.get(id)!),
				);
		}
	});

	it("keep the local elections add-on in step with the recorded licence years", () => {
		const split = DATASET_SPLIT_MODULES.find(
			({ id }) => id === "politics-sharealike",
		);
		expect(split?.holds).toBe("licensed-rows");
		if (split?.holds !== "licensed-rows") return;
		const definition = readFileSync(
			join(
				process.cwd(),
				"packages/datasets/src/politics/local-elections/local-election/dataset.ts",
			),
			"utf8",
		);
		const years = /CC BY-SA 3\.0 \((\d{4})\S(\d{4})\)/.exec(definition);
		expect(
			years,
			"the local-election licence names the CC BY-SA years",
		).not.toBeNull();
		expect(split.electionDates?.from.slice(0, 4)).toBe(years![1]);
		expect(split.electionDates?.to.slice(0, 4)).toBe(years![2]);
	});
});

describe("chart component folders", () => {
	const COMPONENTS = join(process.cwd(), "components/datasets");
	const folders = (path: string) =>
		readdirSync(path, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name);

	const found = () => {
		const paths: string[] = [];
		for (const theme of folders(COMPONENTS))
			for (const topic of folders(join(COMPONENTS, theme)))
				for (const id of folders(join(COMPONENTS, theme, topic)))
					paths.push(`${theme}/${topic}/${id}`);
		return paths;
	};

	it("sit at <theme>/<topic>/<id> for a registered dataset", () => {
		const registered = new Set(
			DATASETS.filter(({ topic }) => isDatasetTopic(topic)).map(
				({ id, topic }) =>
					`${themeOfTopic(topic as DatasetTopic)}/${topic}/${id}`,
			),
		);
		expect(found().filter((path) => !registered.has(path))).toEqual([]);
	});

	it("only use folders for themes and topics that exist", () => {
		const themes = new Set(DATASET_TOPICS.map(({ theme }) => theme));
		for (const theme of folders(COMPONENTS)) {
			expect(themes.has(theme as never), theme).toBe(true);
			for (const topic of folders(join(COMPONENTS, theme))) {
				expect(isDatasetTopic(topic), `${theme}/${topic}`).toBe(true);
				expect(themeOfTopic(topic as DatasetTopic), topic).toBe(theme);
			}
		}
	});
});
