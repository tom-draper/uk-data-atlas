import { createHash } from "node:crypto";
import type { AreaInventory } from "./areaInventory";
import type { BoundaryRegistry } from "./boundaryRegistry";
import type {
	CrosswalkInventory,
	CrosswalkMethod,
	CrosswalkQuality,
	CrosswalkWeighting,
} from "./crosswalkInventory";
import type { SourceInventory } from "./sourceInventory";
import { releaseKey } from "./geographyKeys";

export type GeographyRelationship = {
	id: string;
	direction: "from" | "to";
	counterpart: { geography: string; boundaryRelease: string };
	method: CrosswalkMethod;
	quality: CrosswalkQuality;
	weighting: CrosswalkWeighting;
};

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
				status: "unsupported";
				reason: string;
		  };
	relationships:
		| {
				status: "available";
				crosswalks: GeographyRelationship[];
		  }
		| {
				status: "unsupported";
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
		/** A compiled backlog for completing this geography's resolver support. */
		capabilities: {
			areaIdentities: {
				availableReleaseCount: number;
				unsupportedReleaseCount: number;
				availableAreaCount: number;
			};
			relationships: {
				availableReleaseCount: number;
				unsupportedReleaseCount: number;
				crosswalkCount: number;
			};
		};
	}>;
};

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const toKebabCase = (value: string) =>
	value.replaceAll(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

const pending = {
	status: "unsupported" as const,
	reason: "No API compiler adapter has been published for this release yet.",
};

const relationshipsPending = {
	status: "unsupported" as const,
	reason: "No published crosswalk references this boundary release yet.",
};

const crosswalksByRelease = (
	crosswalkInventory: CrosswalkInventory | undefined,
): Map<string, GeographyRelationship[]> => {
	const map = new Map<string, GeographyRelationship[]>();
	for (const crosswalk of crosswalkInventory?.crosswalks ?? []) {
		const sides: Array<
			["from" | "to", typeof crosswalk.from, typeof crosswalk.to]
		> = [
			["from", crosswalk.from, crosswalk.to],
			["to", crosswalk.to, crosswalk.from],
		];
		for (const [direction, side, counterpart] of sides) {
			const key = releaseKey(side.geography, side.boundaryRelease);
			const relationships = map.get(key) ?? [];
			relationships.push({
				id: crosswalk.id,
				direction,
				counterpart,
				method: crosswalk.method,
				quality: crosswalk.quality,
				weighting: crosswalk.weighting,
			});
			map.set(key, relationships);
		}
	}
	return map;
};

export const createGeographyInventory = (
	boundaryRegistry: BoundaryRegistry,
	sourceInventory: SourceInventory,
	areaInventory?: AreaInventory,
	crosswalkInventory?: CrosswalkInventory,
): GeographyInventory => {
	const areasByRelease = new Map(
		areaInventory?.releases.map((release) => [
			releaseKey(release.geography, release.id),
			release,
		]) ?? [],
	);
	const relationshipsByRelease = crosswalksByRelease(crosswalkInventory);
	const sourceByKey = new Map(
		sourceInventory.sources.map((source) => [source.key, source]),
	);
	const releases = boundaryRegistry.releases.map((release) => {
		const source = sourceByKey.get(
			`boundaries/${toKebabCase(release.geography)}/${release.id}`,
		);
		const areaRelease = areasByRelease.get(
			releaseKey(release.geography, release.id),
		);
		const relationships = relationshipsByRelease.get(
			releaseKey(release.geography, release.id),
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
					: areaRelease
						? {
								status: "unsupported" as const,
								reason: areaRelease.reason,
							}
						: pending,
			relationships: relationships
				? { status: "available" as const, crosswalks: relationships }
				: relationshipsPending,
		};
	});
	const geographyCapabilities = new Map<
		string,
		{
			countries: Set<string>;
			releaseCount: number;
			areaIdentities: {
				availableReleaseCount: number;
				unsupportedReleaseCount: number;
				availableAreaCount: number;
			};
			relationships: {
				availableReleaseCount: number;
				unsupportedReleaseCount: number;
				crosswalkCount: number;
			};
		}
	>();
	for (const release of releases) {
		const capability = geographyCapabilities.get(release.geography) ?? {
			countries: new Set<string>(),
			releaseCount: 0,
			areaIdentities: {
				availableReleaseCount: 0,
				unsupportedReleaseCount: 0,
				availableAreaCount: 0,
			},
			relationships: {
				availableReleaseCount: 0,
				unsupportedReleaseCount: 0,
				crosswalkCount: 0,
			},
		};
		release.countries.forEach((country) => capability.countries.add(country));
		capability.releaseCount += 1;
		if (release.areaIdentities.status === "available") {
			capability.areaIdentities.availableReleaseCount += 1;
			capability.areaIdentities.availableAreaCount +=
				release.areaIdentities.recordCount;
		} else {
			capability.areaIdentities.unsupportedReleaseCount += 1;
		}
		if (release.relationships.status === "available") {
			capability.relationships.availableReleaseCount += 1;
			capability.relationships.crosswalkCount +=
				release.relationships.crosswalks.length;
		} else {
			capability.relationships.unsupportedReleaseCount += 1;
		}
		geographyCapabilities.set(release.geography, capability);
	}
	const geographies = [...geographyCapabilities.entries()]
		.map(([id, capability]) => ({
			id,
			countries: [...capability.countries].sort(),
			releaseCount: capability.releaseCount,
			capabilities: {
				areaIdentities: capability.areaIdentities,
				relationships: capability.relationships,
			},
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
