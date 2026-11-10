import { decodeCompactPayload } from "@uk-data-atlas/catalogue/compactPayload";
import { readBaseDatasetInput } from "../catalog/baseDatasetInput.ts";
import { ROOT } from "./paths.ts";
import type {
	CatalogueDefinition,
	CompiledDatasets,
	ExistingManifestDataset,
} from "./types.ts";

const RUN_COMPILE = "Run pnpm data:build --only atlas-sqlite first.";

/**
 * Reads catalogue metadata from the base database. Regional payloads are
 * loaded from database rows only when chunks need to be rebuilt.
 */
export async function publishDatasets(
	definitions: readonly CatalogueDefinition[],
	compiledDatasets: CompiledDatasets,
	fingerprints: Readonly<Record<string, string>>,
	root = ROOT,
): Promise<ExistingManifestDataset[]> {
	let manifest: { datasets: ExistingManifestDataset[] };
	try {
		manifest = JSON.parse(readBaseDatasetInput(root, "dataset-manifest"));
	} catch (cause) {
		throw new Error(
			`No dataset manifest in atlas-base.sqlite. ${RUN_COMPILE}`,
			{ cause },
		);
	}
	const entries = new Map(
		manifest.datasets.map((entry) => [entry.type, entry]),
	);
	return definitions.map((definition) => {
		const entry = entries.get(definition.type);
		if (!entry || entry.output !== definition.precompiledFile)
			throw new Error(
				`atlas-base.sqlite has no ${definition.type}. ${RUN_COMPILE}`,
			);
		if (entry.fingerprint !== fingerprints[definition.type])
			throw new Error(
				`Dataset ${entry.output} is out of date. ${RUN_COMPILE}`,
			);
		if (definition.payload?.regionChunks?.kind === "regional")
			compiledDatasets.set(definition.precompiledFile, {
				load: async () =>
					decodeCompactPayload(
						JSON.parse(
							readBaseDatasetInput(
								root,
								definition.precompiledFile,
							),
						),
					),
				layout: definition.payload,
			});
		return entry;
	});
}
