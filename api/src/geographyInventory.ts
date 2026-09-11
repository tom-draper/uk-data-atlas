import { createHash } from "node:crypto";
import type { AreaInventory } from "./areaInventory";
import type { BoundaryRegistry } from "./boundaryRegistry";
import type { SourceInventory } from "./sourceInventory";

export type GeographyReleaseInventory = {
	id: string;
	geography: string;
	countries: string[];
	inputFormats: string[];
	areaIdentities:
		| {
				status: "available";
				recordCount: number;
				artifact: string;
		  }
		| {
				status: "not-compiled";
				reason: string;
		  };
	relationships: {
		status: "not-compiled";
		reason: string;
	};
};

export type GeographyInventory = {
	schemaVersion: 1;
	contentHash: string;
	boundaryRegistryHash: string;
	releases: GeographyReleaseInventory[];
	geographies: Array<{
		id: string;
		countries: string[];
		releaseCount: number;
	}>;
};

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const toKebabCase = (value: string) =>
	value.replaceAll(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

const pending = {
	status: "not-compiled" as const,
	reason: "No API compiler adapter has been published for this release yet.",
};

export const createGeographyInventory = (
	boundaryRegistry: BoundaryRegistry,
	sourceInventory: SourceInventory,
	areaInventory?: AreaInventory,
): GeographyInventory => {
	const areasByRelease = new Map(
		areaInventory?.releases.map((release) => [
			`${release.geography}/${release.id}`,
			release,
		]) ?? [],
	);
	const sourceByKey = new Map(
		sourceInventory.sources.map((source) => [source.key, source]),
	);
	const releases = boundaryRegistry.releases.map((release) => {
		const source = sourceByKey.get(
			`boundaries/${toKebabCase(release.geography)}/${release.id}`,
		);
		const areaRelease = areasByRelease.get(
			`${release.geography}/${release.id}`,
		);
		return {
			id: release.id,
			geography: release.geography,
			countries: release.coverage.countries,
			inputFormats: [
				...new Set(source?.files.map((file) => file.extension) ?? []),
			].sort(),
			areaIdentities:
				areaRelease?.status === "available"
					? {
							status: "available" as const,
							recordCount: areaRelease.recordCount,
							artifact: areaRelease.artifact,
						}
					: (areaRelease ?? pending),
			relationships: pending,
		};
	});
	const geographyCountries = new Map<string, Set<string>>();
	const geographyCounts = new Map<string, number>();
	for (const release of releases) {
		const countries =
			geographyCountries.get(release.geography) ?? new Set<string>();
		release.countries.forEach((country) => countries.add(country));
		geographyCountries.set(release.geography, countries);
		geographyCounts.set(
			release.geography,
			(geographyCounts.get(release.geography) ?? 0) + 1,
		);
	}
	const geographies = [...geographyCountries.entries()]
		.map(([id, countries]) => ({
			id,
			countries: [...countries].sort(),
			releaseCount: geographyCounts.get(id) ?? 0,
		}))
		.sort((left, right) => left.id.localeCompare(right.id));
	const content = JSON.stringify({
		schemaVersion: 1,
		boundaryRegistryHash: boundaryRegistry.contentHash,
		releases,
		geographies,
	});

	return {
		schemaVersion: 1,
		contentHash: sha256(content),
		boundaryRegistryHash: boundaryRegistry.contentHash,
		releases,
		geographies,
	};
};
