/**
 * Choosing a subset of datasets to precompile, and folding their results back
 * into the manifest a full run wrote.
 */

type Selectable = { type: string; precompiledFile: string };
type ManifestEntry = { type: string };

/**
 * The dataset names passed after `--only`, split on commas. Returns null when
 * the flag is absent, so a plain run still compiles everything.
 */
export function parseOnlyArgument(argv: readonly string[]): string[] | null {
	const index = argv.findIndex(
		(arg) => arg === "--only" || arg.startsWith("--only="),
	);
	if (index === -1) return null;
	const flag = argv[index];
	const values = flag.startsWith("--only=")
		? [flag.slice("--only=".length)]
		: argv.slice(index + 1).filter((arg) => !arg.startsWith("--"));
	const names = values
		.flatMap((value) => value.split(","))
		.map((name) => name.trim())
		.filter(Boolean);
	if (names.length === 0)
		throw new Error(
			"--only needs at least one dataset, e.g. --only claimantCount",
		);
	return names;
}

/**
 * The definitions named, by dataset type or by output file, in catalogue
 * order. An unknown name fails with the full list, so a typo is not a silent
 * no-op.
 */
export function selectDefinitions<T extends Selectable>(
	definitions: readonly T[],
	names: readonly string[],
): T[] {
	const unknown = names.filter(
		(name) =>
			!definitions.some(
				(definition) =>
					definition.type === name ||
					definition.precompiledFile === name,
			),
	);
	if (unknown.length > 0) {
		const known = definitions
			.map((definition) => definition.type)
			.sort()
			.join(", ");
		throw new Error(
			`Unknown dataset ${unknown.join(", ")}. Choose from: ${known}`,
		);
	}
	return definitions.filter((definition) =>
		names.some(
			(name) =>
				definition.type === name || definition.precompiledFile === name,
		),
	);
}

/**
 * The manifest's entries with the recompiled ones replaced, in catalogue
 * order. Entries for datasets no longer in the catalogue are dropped, as a full
 * run would drop them.
 */
export function mergeManifestEntries<T extends ManifestEntry>(
	existing: readonly T[],
	updated: readonly T[],
	catalogueOrder: readonly string[],
): T[] {
	const byType = new Map(existing.map((entry) => [entry.type, entry]));
	for (const entry of updated) byType.set(entry.type, entry);
	return catalogueOrder.flatMap((type) => {
		const entry = byType.get(type);
		return entry ? [entry] : [];
	});
}
