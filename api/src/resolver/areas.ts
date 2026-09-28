import type { AreaInventory, AreaLookup, AreaRecord } from "../areaInventory";
import { areaKey, releaseKey } from "../geographyKeys";
import { explainAreaAbsence, type AreaAbsence } from "../areaAbsence";
import {
	summariseBatch,
	validateBatch,
	type ValidatedValue,
} from "../batchValidation";
import type { BoundaryRegistry } from "../boundaryRegistry";
import { resolvePlaces } from "../placeResolver";
import type { PlaceIndexArtifact } from "../placeIndex";
import {
	AreaSearch,
	type AreaMatches,
	type AreaSearchFilters,
	type AreaSearchIndexArtifact,
} from "../areaSearch";
import {
	derivedReleaseSources,
	selectReleaseForDate,
	type ReleaseSelection,
} from "../releaseForDate";

export type GeographyEndpoint = { geography: string; boundaryRelease: string };
export type AreaIdentity = GeographyEndpoint & { code: string };

export const areaId = ({ geography, boundaryRelease, code }: AreaIdentity) =>
	areaKey(geography, boundaryRelease, code);

export type ResolvedSameCodeArea = AreaRecord & {
	id: string;
	geography: string;
	boundaryRelease: string;
	/** The identifier recurs; no unchanged-boundary claim is implied. */
	status: "same-code-continuity";
};

export type AreasResolverInputs = {
	boundaryRegistry?: BoundaryRegistry;
	areaInventory?: AreaInventory;
	areaLookup?: AreaLookup;
	placeIndex?: PlaceIndexArtifact;
	areaSearchIndex?: AreaSearchIndexArtifact;
};

/** Area identity, release and place indexes over immutable compiled artifacts. */
export class AreasResolver {
	private readonly areaSearch?: AreaSearch;
	/** Each geography's releases in the area inventory, oldest first. */
	private readonly geographyReleases = new Map<string, string[]>();
	private readonly boundaryReleases = new Map<
		string,
		BoundaryRegistry["releases"][number]
	>();
	private readonly derivedSources: Map<string, string>;

	constructor(private readonly inputs: AreasResolverInputs) {
		this.derivedSources = derivedReleaseSources(inputs.areaInventory);
		for (const release of inputs.boundaryRegistry?.releases ?? [])
			this.boundaryReleases.set(
				releaseKey(release.geography, release.id),
				release,
			);
		if (inputs.areaLookup) {
			this.areaSearch = inputs.areaSearchIndex
				? new AreaSearch(inputs.areaSearchIndex, inputs.areaLookup)
				: undefined;
			for (const releaseIdentity of inputs.areaLookup.keys()) {
				const [geography, boundaryRelease] = releaseIdentity.split(
					"/",
					2,
				);
				if (!geography || !boundaryRelease) continue;
				const releases = this.geographyReleases.get(geography) ?? [];
				releases.push(boundaryRelease);
				this.geographyReleases.set(geography, releases);
			}
			for (const releases of this.geographyReleases.values())
				releases.sort((left, right) => left.localeCompare(right));
		}
	}

	area(identity: AreaIdentity): AreaRecord | undefined {
		return this.inputs.areaLookup
			?.get(releaseKey(identity.geography, identity.boundaryRelease))
			?.get(identity.code);
	}

	hasAreas() {
		return this.inputs.areaLookup !== undefined;
	}

	releaseAreas(geography: string, boundaryRelease: string) {
		return this.inputs.areaLookup?.get(
			releaseKey(geography, boundaryRelease),
		);
	}

	countryIdentity(code: string) {
		for (const identity of [...(this.inputs.areaLookup?.keys() ?? [])]
			.filter((key) => key.startsWith("country/"))
			.sort()
			.reverse()) {
			const boundaryRelease = identity.slice("country/".length);
			const area = this.area({
				geography: "country",
				boundaryRelease,
				code,
			});
			if (area)
				return {
					id: areaKey("country", boundaryRelease, code),
					boundaryRelease,
					...area,
				};
		}
		return undefined;
	}

	hasPlaceIndex() {
		return this.inputs.placeIndex !== undefined;
	}

	places(query: string, limit: number) {
		if (!this.inputs.placeIndex) return [];
		return resolvePlaces(this.inputs.placeIndex, query, limit);
	}

	hasAreaRelease(geography: string, boundaryRelease: string): boolean {
		return (
			this.inputs.areaLookup?.has(
				releaseKey(geography, boundaryRelease),
			) ?? false
		);
	}

	areaCodes(
		geography: string,
		boundaryRelease: string,
	): string[] | undefined {
		const areas = this.inputs.areaLookup?.get(
			releaseKey(geography, boundaryRelease),
		);
		return areas ? [...areas.keys()] : undefined;
	}

	boundaryRelease(geography: string, id: string) {
		return this.boundaryReleases.get(releaseKey(geography, id));
	}

	boundaryReleasesFor(geography?: string): BoundaryRegistry["releases"] {
		return (
			geography
				? [...this.boundaryReleases.values()].filter(
						(release) => release.geography === geography,
					)
				: [...this.boundaryReleases.values()]
		) as BoundaryRegistry["releases"];
	}

	/**
	 * The code in every other release of its geography, oldest first. A
	 * geography has a few dozen releases at most, so this is that many
	 * lookups and needs no index of its own.
	 */
	sameCode(identity: AreaIdentity): ResolvedSameCodeArea[] {
		const { geography, code } = identity;
		return (this.geographyReleases.get(geography) ?? []).flatMap(
			(boundaryRelease) => {
				if (boundaryRelease === identity.boundaryRelease) return [];
				const area = this.area({ geography, boundaryRelease, code });
				return area
					? [
							{
								id: areaId({
									geography,
									boundaryRelease,
									code,
								}),
								geography,
								boundaryRelease,
								...area,
								status: "same-code-continuity" as const,
							},
						]
					: [];
			},
		);
	}

	explainAreaAbsence(
		geography: string,
		boundaryRelease: string,
		code: string,
	): AreaAbsence | undefined {
		return this.inputs.boundaryRegistry
			? explainAreaAbsence(
					this.inputs.boundaryRegistry,
					this.inputs.areaInventory,
					this.inputs.areaLookup,
					geography,
					boundaryRelease,
					code,
				)
			: undefined;
	}

	validateAreas(
		geography: string,
		boundaryRelease: string,
		values: string[],
	):
		| {
				values: ValidatedValue[];
				summary: ReturnType<typeof summariseBatch>;
		  }
		| undefined {
		if (
			!this.inputs.areaLookup?.has(releaseKey(geography, boundaryRelease))
		)
			return undefined;
		const validated = validateBatch(
			this.inputs.areaLookup,
			geography,
			boundaryRelease,
			values,
		);
		return { values: validated, summary: summariseBatch(validated) };
	}

	selectReleaseForDate(
		geography: string,
		month: string,
		country?: string,
	): ReleaseSelection | undefined {
		return this.inputs.boundaryRegistry
			? selectReleaseForDate(
					this.inputs.boundaryRegistry,
					geography,
					month,
					country,
					this.derivedSources,
				)
			: undefined;
	}

	hasAreaSearch() {
		return this.areaSearch !== undefined;
	}

	searchAreas(query: AreaSearchFilters & { query?: string }): AreaMatches {
		return (
			this.areaSearch?.search(query) ?? {
				length: 0,
				positionOf: () => -1,
				slice: () => [],
			}
		);
	}

	exactAreaCandidates(query: AreaSearchFilters & { query: string }) {
		return this.areaSearch?.exactCandidates(query) ?? [];
	}
}
