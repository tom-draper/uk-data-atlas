import { lazyValue } from "../../storage/lazyValue";
import type {
	AreaInventory,
	AreaLookup,
	AreaRecord,
} from "@uk-data-atlas/areas";
import { areaKey, releaseKey } from "@uk-data-atlas/geography";
import { explainAreaAbsence, type AreaAbsence } from "../areaAbsence";
import {
	summariseBatch,
	validateBatch,
	type ValidatedValue,
} from "../batchValidation";
import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import { resolvePlaces } from "@uk-data-atlas/places";
import type { PlaceIndex } from "../../places/placeIndex";
import {
	AreaSearch,
	type AreaMatches,
	type AreaSearchFilters,
	type AreaSearchIndex,
} from "../areaSearch";
import {
	compareBoundaryReleases,
	derivedReleaseSources,
	selectReleaseForDate,
	type ReleaseSelection,
} from "../releaseForDate";
import { exactNameMatch, type NameMatch } from "@uk-data-atlas/geography";

import type { GeographyEndpoint, AreaIdentity } from "@uk-data-atlas/geography";
export type { GeographyEndpoint, AreaIdentity } from "@uk-data-atlas/geography";

export const areaId = ({ geography, boundaryRelease, code }: AreaIdentity) =>
	areaKey(geography, boundaryRelease, code);

export type ResolvedSameCodeArea = AreaRecord & {
	id: string;
	geography: string;
	boundaryRelease: string;
	/** The identifier recurs; no unchanged-boundary claim is implied. */
	status: "same-code-continuity";
};

export type ResolvedCodeRelease = AreaRecord & {
	id: string;
	geography: string;
	boundaryRelease: string;
};

export type ResolvedAreaCandidate = {
	area: AreaRecord & AreaIdentity;
	matches: Array<"code-exact" | Exclude<NameMatch, "prefix">>;
};

export type AreasResolverInputs = {
	boundaryRegistry?: BoundaryRegistry;
	areaInventory?: AreaInventory;
	areaLookup?: AreaLookup;
	placeIndex?: PlaceIndex;
	areaSearchIndex?: AreaSearchIndex;
};

/** Area identity, release and place indexes over immutable compiled artifacts. */
export class AreasResolver {
	private readonly areaSearch: () => AreaSearch | undefined;
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
		this.areaSearch = lazyValue(() =>
			inputs.areaSearchIndex && inputs.areaLookup
				? new AreaSearch(inputs.areaSearchIndex, inputs.areaLookup)
				: undefined,
		);
		if (inputs.areaLookup) {
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
			for (const [geography, releases] of this.geographyReleases)
				releases.sort((left, right) => {
					const leftRelease = this.boundaryReleases.get(
						releaseKey(geography, left),
					);
					const rightRelease = this.boundaryReleases.get(
						releaseKey(geography, right),
					);
					return leftRelease && rightRelease
						? compareBoundaryReleases(leftRelease, rightRelease)
						: left.localeCompare(right);
				});
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

	/** Every exact geography/release pair with compiled area identities. */
	areaReleases(): GeographyEndpoint[] {
		return [...(this.inputs.areaLookup?.keys() ?? [])]
			.map((identity) => {
				const [geography, boundaryRelease] = identity.split("/", 2);
				return geography && boundaryRelease
					? { geography, boundaryRelease }
					: undefined;
			})
			.filter(
				(endpoint): endpoint is GeographyEndpoint =>
					endpoint !== undefined,
			)
			.sort(
				(left, right) =>
					left.geography.localeCompare(right.geography) ||
					right.boundaryRelease.localeCompare(left.boundaryRelease),
			);
	}

	releaseAreas(geography: string, boundaryRelease: string) {
		return this.inputs.areaLookup?.get(
			releaseKey(geography, boundaryRelease),
		);
	}

	countryIdentity(code: string) {
		for (const boundaryRelease of [
			...(this.geographyReleases.get("country") ?? []),
		].reverse()) {
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

	places(query: string, limit: number, asOf?: string) {
		if (!this.inputs.placeIndex) return [];
		return resolvePlaces(this.inputs.placeIndex, query, limit, asOf);
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

	/** Every compiled release of this geography holding the code, oldest first. */
	codeReleases(identity: AreaIdentity): ResolvedCodeRelease[] {
		const { geography, code } = identity;
		return (this.geographyReleases.get(geography) ?? []).flatMap(
			(boundaryRelease) => {
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
							},
						]
					: [];
			},
		);
	}

	/**
	 * The code in every other release of its geography, oldest first. A
	 * geography has a few dozen releases at most, so this is that many
	 * lookups and needs no index of its own.
	 */
	sameCode(identity: AreaIdentity): ResolvedSameCodeArea[] {
		return this.codeReleases(identity)
			.filter(
				(candidate) =>
					candidate.boundaryRelease !== identity.boundaryRelease,
			)
			.map((candidate) => ({
				...candidate,
				status: "same-code-continuity" as const,
			}));
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
		return this.inputs.areaSearchIndex !== undefined;
	}

	searchAreas(query: AreaSearchFilters & { query?: string }): AreaMatches {
		return (
			this.areaSearch()?.search(query) ?? {
				length: 0,
				positionOf: () => -1,
				slice: () => [],
			}
		);
	}

	exactAreaCandidates(query: AreaSearchFilters & { query: string }) {
		return this.areaSearch()?.exactCandidates(query) ?? [];
	}

	resolveAreaCandidates(query: AreaSearchFilters & { query: string }) {
		return this.exactAreaCandidates(query).flatMap((area) => {
			const matches = [
				...(area.code.toLocaleLowerCase() ===
				query.query.toLocaleLowerCase()
					? (["code-exact"] as const)
					: []),
				...[area.name, ...(area.aliases ?? [])].flatMap((label) => {
					const match = exactNameMatch(label, query.query);
					return match ? [match] : [];
				}),
			];
			return matches.length > 0
				? [
						{
							area,
							matches: [...new Set(matches)],
						},
					]
				: [];
		});
	}
}
