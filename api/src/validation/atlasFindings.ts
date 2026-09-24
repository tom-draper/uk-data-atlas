import { type Finding, listed, check } from "./findings";
import type { ValidationInputs } from "./inputs";
import { releaseKey } from "../geographyKeys";

export const atlasFindings = (inputs: ValidationInputs): Finding[] => {
	const registryHash = inputs.boundaryRegistry.contentHash;
	const staleInventories = [
		["area inventory", inputs.areaInventory.boundaryRegistryHash],
		["geography inventory", inputs.geographyInventory.boundaryRegistryHash],
	]
		.filter(([, hash]) => hash !== registryHash)
		.map(([name]) => name);
	const staleExports =
		inputs.exportManifest.dataCatalogHash !==
		inputs.dataCatalog.contentHash;
	const releaseIds = new Set(
		inputs.boundaryRegistry.releases.map((release) =>
			releaseKey(release.geography, release.id),
		),
	);
	const inventories: Array<[string, string[]]> = [
		[
			"area inventory",
			inputs.areaInventory.releases.map((release) =>
				releaseKey(release.geography, release.id),
			),
		],
		[
			"geometry source registry",
			inputs.geometrySources.releases.map((release) =>
				String(release.id),
			),
		],
		[
			"geography inventory",
			inputs.geographyInventory.releases.map((release) =>
				releaseKey(release.geography, release.id),
			),
		],
	];
	const mismatches = inventories.flatMap(([name, ids]) => {
		const present = new Set(ids);
		const missing = [...releaseIds].filter((id) => !present.has(id));
		const extra = ids.filter((id) => !releaseIds.has(id));
		return missing.length + extra.length === 0
			? []
			: [
					`${name} is missing ${missing.length} and adds ${extra.length} releases (${listed([...missing, ...extra], 5)})`,
				];
	});
	return [
		check(
			"registry-links",
			staleInventories.length === 0 && !staleExports,
			[
				staleInventories.length > 0
					? `Built against an older boundary registry: ${staleInventories.join(", ")}.`
					: undefined,
				staleExports
					? "Built against an older data catalogue: export manifest."
					: undefined,
			]
				.filter((part) => part !== undefined)
				.join(" "),
		),
		check(
			"release-coverage",
			mismatches.length === 0,
			`${mismatches.join("; ")}.`,
			{ boundaryReleaseCount: releaseIds.size },
		),
	];
};
