import { ID_NAMESPACES, idNamespaces } from "./idRegistries.ts";
import { checkAppendOnly } from "./idRegistry.ts";

/** The registry files, by path relative to `pipeline/ids`, and their text. */
export type RegistryTexts = ReadonlyMap<string, string>;

const segmentedDirectories = idNamespaces
	.filter((name) => ID_NAMESPACES[name].segmented)
	.map((name) => `${name.replaceAll("_", "-")}/`);

/**
 * What is wrong with `current` as a successor of `base`. A registry that is
 * one file may only have lines added at its end. A file of a segmented
 * registry was written once, so it must be there and byte for byte the same;
 * new files are how it grows.
 */
export const registryProblems = (
	current: RegistryTexts,
	base: RegistryTexts,
): string[] => {
	const problems: string[] = [];
	for (const [path, before] of base) {
		const after = current.get(path);
		if (after === undefined)
			problems.push(
				`${path} is in the base and is gone: ids may not be removed`,
			);
		else if (
			segmentedDirectories.some((directory) => path.startsWith(directory))
		) {
			if (after !== before)
				problems.push(
					`${path} differs from the base: a segmented file is written once and never changed`,
				);
		} else if (!checkAppendOnly(before, after))
			problems.push(
				`${path} changes lines that are in the base: ids may only be added at the end`,
			);
	}
	return problems;
};
