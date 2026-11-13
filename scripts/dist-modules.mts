import {
	CORE_COMPATIBILITY_KEY,
	MODULE_LICENCES,
	buildModuleManifests,
	getRegisteredDataset,
	type DatasetFoundationPart,
	type ModuleLicenceInfo,
	type ModuleManifest,
} from "@uk-data-atlas/datasets/registry";

/**
 * The files of `data/dist/uk-data-atlas-<release>/` that need no module
 * database: the manifests, the READMEs and the indexes
 * (docs/data-organisation.md, "Build and distribution"). Everything here is a
 * pure function of the registry and the facts read from `data/source`, so the
 * same inputs give the same bytes. `build-dist.mts` reads the sources and
 * writes the result.
 *
 * Task 13 builds the module databases and fills the `build` field of each
 * manifest; until then the READMEs say the database is not built and show no
 * size.
 */

/** What a source's `meta.json` says, as far as the READMEs use it. */
export interface SourceFact {
	title: string;
	publisher: string;
	sourceUrl: string;
	licenceName: string;
	licenceUrl?: string;
	attribution: readonly string[];
}

/** The facts for every dataset and foundation part, read from the sources. */
export interface DistFacts {
	datasets: Readonly<Record<string, readonly SourceFact[]>>;
	foundation: Readonly<Record<DatasetFoundationPart, readonly SourceFact[]>>;
}

export const FOUNDATION_PARTS = ["core", "boundaries", "postcodes"] as const;

/** Where the database of a module will be written by task 13. */
export const databasePath = (moduleId: string) =>
	`sqlite/atlas-${moduleId}.sqlite`;
export const manifestPath = (moduleId: string) =>
	`sqlite/atlas-${moduleId}.manifest.json`;

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\s+/g, " ");

const table = (header: readonly string[], rows: readonly string[][]) =>
	[
		`| ${header.join(" | ")} |`,
		`| ${header.map(() => "---").join(" | ")} |`,
		...rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
	].join("\n");

const uniqueBy = <T,>(items: readonly T[], key: (item: T) => string) => [
	...new Map(items.map((item) => [key(item), item])).values(),
];

/** The distinct sources behind a list of facts, keeping the first of each. */
const distinctSources = (facts: readonly SourceFact[]) =>
	uniqueBy(
		facts,
		(fact) => `${fact.publisher}\n${fact.sourceUrl}\n${fact.licenceName}`,
	);

const licenceLink = (licence: ModuleLicenceInfo) =>
	`[${licence.name}](${licence.url})`;

const licenceTerms = (licence: ModuleLicenceInfo) =>
	[
		licence.commercialUse ? "Commercial use allowed" : "No commercial use",
		licence.shareAlike ? "ShareAlike" : "No ShareAlike condition",
	].join(", ");

const datasetFacts = (facts: DistFacts, manifest: ModuleManifest) =>
	manifest.kind === "foundation"
		? facts.foundation[manifest.id as DatasetFoundationPart]
		: manifest.datasets.flatMap(({ id }) => facts.datasets[id] ?? []);

const usageSection = (manifest: ModuleManifest) => {
	const file = databasePath(manifest.id);
	const alias = manifest.id.replace(/[^a-z0-9]/g, "_");
	return [
		"## Using this module",
		"",
		`The module database is \`${file}\`. It is not built yet, so there is nothing to attach today (see Status).`,
		"",
		"Once built, attach it to an SQLite connection that already has core:",
		"",
		"```sql",
		`ATTACH DATABASE '${file}' AS ${alias};`,
		"```",
		"",
		"SQLite attaches at most 10 extra databases to one connection by default, and the `sqlite3` command line and `node:sqlite` both use that limit. Raising it means recompiling SQLite. Attached databases also lose foreign keys across files, and a view or trigger in one file cannot refer to tables in another. To use several modules together, use the assembled `atlas.sqlite` that core plus the modules you choose are joined into, or read the per-module Parquet files with DuckDB, which has no such limit.",
	];
};

/** The README of one module. */
export const renderModuleReadme = (
	manifest: ModuleManifest,
	facts: DistFacts,
	release: string,
): string => {
	const sources = distinctSources(datasetFacts(facts, manifest));
	const lines: string[] = [
		`# ${manifest.label} (\`${manifest.id}\`)`,
		"",
		manifest.description,
		"",
		"This file is generated from the module manifest. Do not edit it.",
		"",
		table(
			["Field", "Value"],
			[
				["Module", `\`${manifest.id}\``],
				["Release", release],
				["Kind", manifest.kind],
				[
					"Always included",
					manifest.alwaysIncluded ? "Yes" : "No, choose it as needed",
				],
				[
					"Datasets",
					manifest.kind === "foundation"
						? "None of its own"
						: String(manifest.datasets.length),
				],
				["Core compatibility", `\`${manifest.compatibility.core}\``],
				["Manifest schema version", String(manifest.schemaVersion)],
				["Manifest", `\`${manifestPath(manifest.id)}\``],
			],
		),
		"",
		"## Status",
		"",
		`Not built yet. The module database \`${databasePath(manifest.id)}\`, its Parquet and CSV files and their checksums are produced by the per-module build, and until it runs the manifest records the size and checksums as null.`,
		"",
		"## What is inside",
		"",
	];
	if (manifest.kind === "foundation") {
		lines.push(
			`${manifest.label} holds no datasets of its own. ${manifest.alwaysIncluded ? "Every download contains it." : "Add it when you need it."}`,
		);
	} else {
		for (const topic of manifest.topics) {
			const datasets = manifest.datasets.filter(
				(dataset) => dataset.topic === topic.id,
			);
			lines.push(
				`### ${topic.label} (\`${topic.id}\`)`,
				"",
				topic.description,
				"",
			);
			for (const dataset of datasets) {
				const registered = getRegisteredDataset(dataset.id);
				lines.push(
					`- **${dataset.title}** (\`${dataset.id}\`): ${registered?.about ?? ""}`,
				);
			}
			lines.push("");
		}
	}
	lines.push(
		"",
		"## Sources and licences",
		"",
		manifest.licences === null
			? "Licences were not derived for this module."
			: manifest.licences.length === 0
				? "No licences recorded."
				: table(
						["Licence", "Id", "Terms"],
						manifest.licences.map((licence) => [
							licenceLink(licence),
							`\`${licence.id}\``,
							licenceTerms(licence),
						]),
					),
	);
	if (manifest.licenceConflict) {
		const { shareAlike, others, datasets } = manifest.licenceConflict;
		lines.push(
			"",
			`> **Licence conflict.** This module mixes ShareAlike data (${shareAlike.map((id) => `\`${id}\``).join(", ")}) with data under ${others.map((id) => `\`${id}\``).join(", ")}. ${datasets.length > 0 ? `The ShareAlike data is in ${datasets.map((id) => `\`${id}\``).join(", ")}. ` : ""}Anything built from the ShareAlike data must be shared under the same terms. A planned split puts it in its own module.`,
		);
	}
	if (sources.length > 0) {
		lines.push(
			"",
			table(
				["Source", "Publisher", "Licence"],
				sources.map((source) => [
					`[${source.title}](${source.sourceUrl})`,
					source.publisher,
					source.licenceName,
				]),
			),
		);
	}
	const attributions = [
		...new Set(sources.flatMap((source) => source.attribution)),
	].sort((a, b) => a.localeCompare(b, "en"));
	lines.push("", "## Attribution", "");
	if (attributions.length > 0)
		lines.push(...attributions.map((text) => `- ${text}`));
	else
		lines.push(
			"Credit each publisher named above under the terms of its licence.",
		);
	lines.push(
		"",
		"## Core compatibility",
		"",
		`This module is built against core \`${manifest.compatibility.core}\` (the current key is \`${CORE_COMPATIBILITY_KEY}\`). It joins to the areas, releases and lookups in core, so use it only with a core carrying the same key.`,
		"",
		...usageSection(manifest),
		"",
	);
	return lines.join("\n").replace(/\n{3,}/g, "\n\n");
};

/** The README at the top of the release. */
export const renderIndexReadme = (
	manifests: readonly ModuleManifest[],
	release: string,
): string => {
	const conflicts = manifests.filter(
		({ licenceConflict }) => licenceConflict,
	);
	return [
		`# UK Data Atlas ${release}`,
		"",
		"Open UK public data, organised into modules. This file is generated from the module manifests. Do not edit it.",
		"",
		"A download is the core module plus the modules you choose. `catalogue.json` lists every module, including ones you have not downloaded, so you can tell what needs another module. `licences.json` lists every licence and the modules it applies to.",
		"",
		"## Modules",
		"",
		table(
			["Module", "Label", "Datasets", "Licences", "Database"],
			manifests.map((manifest) => [
				`[\`${manifest.id}\`](${manifest.id}/README.md)`,
				manifest.label,
				manifest.kind === "foundation"
					? "None of its own"
					: String(manifest.datasets.length),
				manifest.licences === null
					? "Not derived"
					: manifest.licences.map(({ id }) => `\`${id}\``).join(", "),
				manifest.build.status === "not-built"
					? "Not built yet"
					: `\`${databasePath(manifest.id)}\``,
			]),
		),
		"",
		...(conflicts.length > 0
			? [
					"## Licence conflicts",
					"",
					...conflicts.map(
						({ id, licenceConflict }) =>
							`- \`${id}\` mixes ShareAlike data (${licenceConflict!.shareAlike.map((licence) => `\`${licence}\``).join(", ")}) with other licences.`,
					),
					"",
				]
			: []),
		"## Layout",
		"",
		"```",
		`uk-data-atlas-${release}/`,
		"  README.md  catalogue.json  licences.json  CHANGELOG.md",
		"  <module>/README.md          what the module holds, its sources and licences",
		"  sqlite/",
		"    atlas-<module>.manifest.json",
		"    atlas-<module>.sqlite     not built yet",
		"```",
		"",
		"Module databases, dataset folders and Parquet files are produced by the per-module build and are not part of this tree yet.",
		"",
		"## Using several modules",
		"",
		"SQLite attaches at most 10 extra databases to one connection by default, and raising the limit means recompiling SQLite. Attached databases also lose foreign keys across files. For SQLite, use one assembled file made from core plus the modules you choose. For DuckDB, read the per-module Parquet files, which have no such limit.",
		"",
	].join("\n");
};

/** CHANGELOG.md of the release. */
export const renderChangelog = (release: string): string =>
	[
		"# Changelog",
		"",
		`## ${release}`,
		"",
		"- Module manifests and READMEs generated from the registry.",
		"- Module databases are not built yet.",
		"",
	].join("\n");

export const renderManifestJson = (
	manifest: ModuleManifest,
	release: string,
): string => `${JSON.stringify({ release, ...manifest }, null, "\t")}\n`;

export const renderCatalogueJson = (
	manifests: readonly ModuleManifest[],
	release: string,
): string =>
	`${JSON.stringify(
		{
			release,
			core: CORE_COMPATIBILITY_KEY,
			modules: manifests.map((manifest) => ({
				id: manifest.id,
				label: manifest.label,
				kind: manifest.kind,
				alwaysIncluded: manifest.alwaysIncluded,
				readme: `${manifest.id}/README.md`,
				manifest: manifestPath(manifest.id),
				database: {
					path: databasePath(manifest.id),
					status: manifest.build.status,
				},
				topics: manifest.topics.map(({ id }) => id),
				datasets: manifest.datasets.map(({ id }) => id),
			})),
			datasets: manifests.flatMap((manifest) =>
				manifest.datasets.map((dataset) => ({
					id: dataset.id,
					title: dataset.title,
					topic: dataset.topic,
					module: manifest.id,
				})),
			),
		},
		null,
		"\t",
	)}\n`;

export const renderLicencesJson = (
	manifests: readonly ModuleManifest[],
	release: string,
): string =>
	`${JSON.stringify(
		{
			release,
			licences: MODULE_LICENCES.map((licence) => ({
				...licence,
				modules: manifests
					.filter((manifest) =>
						manifest.licences?.some(({ id }) => id === licence.id),
					)
					.map(({ id }) => id),
			})),
			conflicts: manifests.flatMap(({ id, licenceConflict }) =>
				licenceConflict ? [{ module: id, ...licenceConflict }] : [],
			),
		},
		null,
		"\t",
	)}\n`;

/** Licence names recorded for each dataset and foundation part. */
export const licenceInputOf = (facts: DistFacts) => ({
	datasets: (datasetId: string) =>
		(facts.datasets[datasetId] ?? []).map((fact) => fact.licenceName),
	foundation: Object.fromEntries(
		FOUNDATION_PARTS.map((part) => [
			part,
			facts.foundation[part].map((fact) => fact.licenceName),
		]),
	) as Record<DatasetFoundationPart, string[]>,
});

/** Every file of the release, by path relative to its root. */
export const planDist = (
	facts: DistFacts,
	release: string,
): Map<string, string> => {
	const manifests = buildModuleManifests(licenceInputOf(facts));
	const files = new Map<string, string>([
		["README.md", renderIndexReadme(manifests, release)],
		["catalogue.json", renderCatalogueJson(manifests, release)],
		["licences.json", renderLicencesJson(manifests, release)],
		["CHANGELOG.md", renderChangelog(release)],
	]);
	for (const manifest of manifests) {
		files.set(
			`${manifest.id}/README.md`,
			renderModuleReadme(manifest, facts, release),
		);
		files.set(
			manifestPath(manifest.id),
			renderManifestJson(manifest, release),
		);
	}
	return files;
};
