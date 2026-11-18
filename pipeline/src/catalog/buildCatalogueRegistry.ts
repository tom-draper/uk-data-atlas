import { existsSync } from "fs";
import { readdir, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { pathToFileURL } from "url";
import { format, resolveConfig } from "prettier";

const ROOT = resolve(import.meta.dirname, "../../..");
const CATALOGUE_DIRECTORY = join(
	ROOT,
	"packages",
	"datasets",
	"src",
	"data",
	"catalog",
);
const DEFINITIONS_DIRECTORY = join(CATALOGUE_DIRECTORY, "definitions");
const DATA_DIRECTORY = join(CATALOGUE_DIRECTORY, "..");
const SOURCE_DIRECTORY = join(DATA_DIRECTORY, "..");
const DECLARATION_DIRECTORY = join(SOURCE_DIRECTORY, "declaration");

const GENERATED_BY = "pipeline/src/stages/build-catalogue-registry.ts";

export type CatalogueDefinitionMetadata = {
	name: string;
	type: string;
	chartPending: boolean;
};

export type CatalogueDefinitionEntry = CatalogueDefinitionMetadata & {
	file: string;
};

type ModuleExports = Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

export function catalogueMetadata(
	file: string,
	module: ModuleExports,
): CatalogueDefinitionMetadata {
	const fail = (message: string): never => {
		throw new Error(`${file} ${message}`);
	};
	const matches: Array<[string, Record<string, unknown>]> = [];
	for (const [name, value] of Object.entries(module)) {
		if (
			name.endsWith("DatasetDefinition") &&
			isRecord(value) &&
			typeof value.precompile === "function"
		) {
			matches.push([name, value]);
		}
	}
	if (matches.length !== 1)
		return fail("must export exactly one *DatasetDefinition value.");
	const [name, definition] = matches[0];
	if (typeof definition.type !== "string") {
		return fail("must declare a string literal dataset type.");
	}
	return {
		name,
		type: definition.type,
		chartPending: definition.chartPending === true,
	};
}

export type DatasetDeclarationEntry = {
	/** The `<theme>/<topic>/<id>` directory under `src/` holding `dataset.ts`. */
	directory: string;
	/** The exported declaration. */
	name: string;
	id: string;
	/** The manifest type: the id, unless the dataset has a legacy type. */
	type: string;
	/** Whether the declaration says how the website draws it. */
	displayed: boolean;
	/** Whether the website has no chart for it yet. */
	chartPending: boolean;
	/** Its topic and what the docs say about it, for the loader-free guides. */
	guide: DeclaredGuideEntry;
	/** The `data/source` folders it reads, as declared. */
	sources: readonly SourceFolderEntry[];
};

/** A `data/source` folder a declaration names, as it is declared. */
export type SourceFolderEntry = {
	name?: string;
	folder?: string;
	core?: true;
	exception?: string;
};

/** A dataset's guide with the topics its declaration files it under. */
export type DeclaredGuideEntry = {
	title: string;
	topic: string;
	related?: readonly string[];
	about: string;
	summary?: string;
	publishedOn?: string;
};

/** Finds the one declaration a dataset module exports. */
export function declarationMetadata(
	file: string,
	module: ModuleExports,
): Omit<DatasetDeclarationEntry, "directory"> {
	const matches = Object.entries(module).filter(
		([, value]) =>
			isRecord(value) &&
			typeof value.id === "string" &&
			typeof value.load === "function",
	);
	if (matches.length !== 1)
		throw new Error(`${file} must export exactly one dataset declaration.`);
	const [name, value] = matches[0] as [string, Record<string, unknown>];
	const id = value.id as string;
	const { legacyType } = value;
	if (legacyType !== undefined && typeof legacyType !== "string")
		throw new Error(`${file} has a legacyType that is not a string.`);
	const guide = value.guide as Record<string, string> | undefined;
	if (!guide) throw new Error(`${file} declares no guide.`);
	return {
		name,
		id,
		type: legacyType ?? id,
		displayed: value.display !== undefined,
		chartPending: value.chartPending === true,
		sources: (value.sources as SourceFolderEntry[] | undefined) ?? [{}],
		guide: {
			title: guide.title!,
			topic: value.topic as string,
			...(value.related ? { related: value.related as string[] } : {}),
			about: guide.about!,
			...(guide.summary !== undefined ? { summary: guide.summary } : {}),
			...(guide.publishedOn !== undefined
				? { publishedOn: guide.publishedOn }
				: {}),
		},
	};
}

const subdirectories = async (path: string): Promise<string[]> =>
	(await readdir(path, { withFileTypes: true }))
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();

/**
 * Every dataset declaration (`<theme>/<topic>/<id>/dataset.ts` under `src/`),
 * in path order. The folder must be named for the declared id; that it also
 * matches the declared theme and topic is checked by the organisation test.
 */
export async function readDatasetDeclarations(): Promise<
	DatasetDeclarationEntry[]
> {
	const found: DatasetDeclarationEntry[] = [];
	for (const theme of await subdirectories(SOURCE_DIRECTORY)) {
		for (const topic of await subdirectories(
			join(SOURCE_DIRECTORY, theme),
		)) {
			const topicDirectory = join(SOURCE_DIRECTORY, theme, topic);
			for (const id of await subdirectories(topicDirectory)) {
				const directory = `${theme}/${topic}/${id}`;
				if (!existsSync(join(topicDirectory, id, "dataset.ts")))
					continue;
				const entry = declarationMetadata(
					`${directory}/dataset.ts`,
					await loadModule(join(topicDirectory, id), "dataset.ts"),
				);
				if (entry.id !== id)
					throw new Error(
						`${directory}/dataset.ts declares id ${entry.id}; the folder is the id.`,
					);
				found.push({ directory, ...entry });
			}
		}
	}
	return found.sort((left, right) => (left.id < right.id ? -1 : 1));
}

/**
 * Writes a generated file in the repository's own formatting. These files are
 * committed, so leaving them unformatted would fail `pnpm format:check` on the
 * next build.
 */
export async function writeGenerated(
	path: string,
	source: string,
): Promise<void> {
	const config = await resolveConfig(path);
	await writeFile(path, await format(source, { ...config, filepath: path }));
}

export const loadModule = async (directory: string, file: string) =>
	(await import(pathToFileURL(join(directory, file)).href)) as Record<
		string,
		unknown
	>;

/** Every catalogue definition module, in stable file order. */
export async function readCatalogueDefinitions(): Promise<
	CatalogueDefinitionEntry[]
> {
	return Promise.all(
		(await readdir(DEFINITIONS_DIRECTORY))
			.filter((file) => file.endsWith(".ts") && file !== "index.ts")
			.sort()
			.map(async (file) => ({
				file: file.replace(/\.ts$/, ""),
				...catalogueMetadata(
					file,
					await loadModule(DEFINITIONS_DIRECTORY, file),
				),
			})),
	);
}

/**
 * The guides of the declared datasets as a module with no imports but a type,
 * so the registry entry point (the API's) can list datasets without loading
 * their readers.
 */
export const renderDeclaredGuides = (
	declarations: readonly DatasetDeclarationEntry[],
): string => `// Generated by ${GENERATED_BY}. Do not edit.
import type { DatasetGuide } from "./guides.ts";

/** The guide of each declared dataset, by id, as its declaration writes it. */
export const DECLARED_GUIDES: Readonly<Record<string, DatasetGuide>> = {
${declarations.map(({ id, guide }) => `\t${JSON.stringify(id)}: ${JSON.stringify(guide)},`).join("\n")}
};
`;

type SourceTables = {
	/** Each source name with the topic (or `core`) it is filed under and its folder, if not the name. */
	names: Map<string, { topic: string; folder?: string }>;
	/** Each folder, relative to `data/source`, with the datasets it feeds. */
	folders: Map<string, { datasets: string[]; exception?: string }>;
};

/**
 * The source names and folders the declarations imply: a dataset that says
 * nothing reads the folder named for its id under its theme and topic. A
 * folder two declarations name is one folder feeding both.
 */
export function declaredSourceTables(
	declarations: readonly DatasetDeclarationEntry[],
): SourceTables {
	const tables: SourceTables = { names: new Map(), folders: new Map() };
	for (const { id, directory, guide, sources } of declarations) {
		const [theme] = directory.split("/");
		for (const source of sources.length ? sources : [{}]) {
			const name = source.name ?? id;
			const topic = source.core ? "core" : guide.topic;
			const folder = source.folder;
			const known = tables.names.get(name);
			if (known && (known.topic !== topic || known.folder !== folder))
				throw new Error(
					`${id} files source ${name} differently from another declaration.`,
				);
			tables.names.set(name, {
				topic,
				...(folder === undefined ? {} : { folder }),
			});
			const path = `${source.core ? "core" : `${theme}/${guide.topic}`}/${folder ?? name}`;
			const row = tables.folders.get(path) ?? { datasets: [] };
			if (!row.datasets.includes(id)) row.datasets.push(id);
			if (source.exception !== undefined) {
				if (
					row.exception !== undefined &&
					row.exception !== source.exception
				)
					throw new Error(`${path} has two exceptions.`);
				row.exception = source.exception;
			}
			tables.folders.set(path, row);
		}
	}
	return tables;
}

/**
 * The source names and folder rows of the declared datasets, as a module with
 * no imports but types, which `sources.ts` and `sourceDatasets.ts` read.
 */
export function renderDeclaredSources(
	declarations: readonly DatasetDeclarationEntry[],
): string {
	const { names, folders } = declaredSourceTables(declarations);
	const entries = [...names]
		.sort(([a], [b]) => (a < b ? -1 : 1))
		.map(
			([name, entry]) =>
				`\t${JSON.stringify(name)}: ${JSON.stringify(entry)},`,
		);
	const rows = [...folders]
		.sort(([a], [b]) => (a < b ? -1 : 1))
		.map(([path, { datasets, exception }]) =>
			JSON.stringify(
				exception === undefined
					? [path, datasets]
					: [path, datasets, exception],
			),
		);
	return `// Generated by ${GENERATED_BY}. Do not edit.
import type { DatasetSource } from "./sourceDatasets.ts";

/** The source names the declared datasets read, with where each is filed. */
export const DECLARED_SOURCES = {
${entries.join("\n")}
} as const;

/** The \`data/source\` folders the declared datasets read, and what feeds from each. */
export const DECLARED_DATASET_SOURCES: readonly DatasetSource[] = [
${rows.map((row) => `\t${row},`).join("\n")}
];
`;
}

/** Writes the definitions index, the registry and the dataset type map. */
export async function writeCatalogueRegistry(
	definitions: readonly CatalogueDefinitionEntry[],
	declarations: readonly DatasetDeclarationEntry[] = [],
): Promise<void> {
	const header = `// Generated by ${GENERATED_BY}. Do not edit.`;
	const exports = definitions
		.map(({ file, name }) => `export { ${name} } from "./${file}.ts";`)
		.join("\n");
	await writeGenerated(
		join(DEFINITIONS_DIRECTORY, "index.ts"),
		`${header}\n${exports}\n`,
	);
	const imports = definitions
		.map(
			({ file, name }) =>
				`import { ${name} } from "./definitions/${file}.ts";`,
		)
		.join("\n");
	const values = definitions.map(({ name }) => `\t${name},`).join("\n");
	await writeGenerated(
		join(DECLARATION_DIRECTORY, "declaredSources.ts"),
		renderDeclaredSources(declarations),
	);
	await writeGenerated(
		join(DECLARATION_DIRECTORY, "declaredGuides.ts"),
		renderDeclaredGuides(declarations),
	);
	await writeGenerated(
		join(DATA_DIRECTORY, "declarations.ts"),
		`${header}
import { definitionOf, type DatasetDeclaration } from "../declaration/dataset.ts";
${declarations.map(({ directory, name }) => `import { ${name} } from "../${directory}/dataset.ts";`).join("\n")}

/** Every dataset declaration, in id order. */
export const DATASET_DECLARATIONS: readonly DatasetDeclaration[] = [
${declarations.map(({ name }) => `\t${name},`).join("\n")}
];

/** The manifest definition of each declaration. */
export const DECLARED_DEFINITIONS = DATASET_DECLARATIONS.map((declaration) =>
	definitionOf(declaration),
);

export type DeclaredDatasetId = ${
			declarations.filter(({ displayed }) => displayed).length === 0
				? "never"
				: declarations
						.filter(({ displayed }) => displayed)
						.map(({ type }) => `"${type}"`)
						.join(" | ")
		};
`,
	);
	await writeGenerated(
		join(CATALOGUE_DIRECTORY, "registry.ts"),
		`${header}
import { DECLARED_DEFINITIONS } from "../declarations.ts";
import type { DatasetDefinition } from "./types.ts";
${imports}

/**
 * Datasets still written by hand as a \`definitions/<name>.ts\` module. A
 * dataset moves out of this list, and into \`DECLARED_DEFINITIONS\`, when it
 * becomes a declaration (\`<theme>/<topic>/<id>/dataset.ts\`).
 */
export const HAND_WRITTEN_DATASET_DEFINITIONS: readonly DatasetDefinition[] = [\n${values}\n];

/** The complete framework-neutral catalogue used by compilers and API consumers. */
export const CATALOGUE_DATASET_DEFINITIONS: readonly DatasetDefinition[] = [
	...HAND_WRITTEN_DATASET_DEFINITIONS,
	...DECLARED_DEFINITIONS,
].sort((left, right) => (left.type < right.type ? -1 : 1));
`,
	);
	const typeImports = definitions
		.map(
			({ file, name }) =>
				`import type { ${name} } from "./definitions/${file}.ts";`,
		)
		.join("\n");
	const declarationImports = declarations
		.map(
			({ directory, name }) =>
				`import type { ${name} } from "../../${directory}/dataset.ts";`,
		)
		.join("\n");
	const datasetTypes = [
		...definitions.map(
			({ name }) =>
				`Awaited<ReturnType<typeof ${name}.precompile>>[string]`,
		),
		...declarations.map(
			({ name }) => `Awaited<ReturnType<typeof ${name}.load>>[string]`,
		),
	].join(" | ");
	const records = definitions
		.map(
			({ type, name }) =>
				`\t"${type}": Awaited<ReturnType<typeof ${name}.precompile>>;`,
		)
		.join("\n");
	const declaredRecords = declarations
		.map(
			({ type, name }) =>
				`\t"${type}": Awaited<ReturnType<typeof ${name}.load>>;`,
		)
		.join("\n");
	await writeGenerated(
		join(CATALOGUE_DIRECTORY, "generated.ts"),
		`${header}\n${typeImports}\n${declarationImports}\n\nexport type CatalogueDataset = ${datasetTypes};\nexport type CatalogueDatasetType = CatalogueDataset["type"];\n/** Records of the datasets declared in \`<theme>/<topic>/<id>/dataset.ts\`, by type. */\nexport type DeclaredDatasetRecords = {\n${declaredRecords}\n};\nexport type CatalogueDatasetRecords = DeclaredDatasetRecords & {\n${records}\n};\n`,
	);
}
