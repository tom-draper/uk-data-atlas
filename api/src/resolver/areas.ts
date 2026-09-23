import type { AreaInventory, AreaLookup, AreaRecord } from "../areaInventory";
import { areaKey, releaseKey } from "../geographyKeys";
import { explainAreaAbsence, type AreaAbsence } from "../areaAbsence";
import {
	summariseBatch,
	validateBatch,
	type ValidatedValue,
} from "../batchValidation";
import type { BoundaryRegistry } from "../boundaryRegistry";
import { createPlaceIndex, resolvePlaces } from "../placeResolver";
import type { PlaceIndex } from "../placeResolver";
import type { NamedLocationInventory } from "../namedLocations";
import {
	createAreaSearchIndex,
	searchAreas,
	type AreaSearchIndex,
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
	namedLocationInventory?: NamedLocationInventory;
};

/** Area identity, release and place indexes over immutable compiled artifacts. */
export class AreasResolver {
	private readonly areaSearchIndex?: AreaSearchIndex;
	private placeIndex?: PlaceIndex;
	private readonly sameCodeAreas = new Map<string, ResolvedSameCodeArea[]>();
	private readonly boundaryReleases = new Map<
		string,
		BoundaryRegistry["releases"][number]
	>();
	private readonly derivedSources: Map<string, string>;

	constructor(private readonly inputs: AreasResolverInputs) {
		this.derivedSources = derivedReleaseSources(inputs.areaInventory);
		for (const release of inputs.boundaryRegistry?.releases ?? [])
			this.boundaryReleases.set(releaseKey(release.geography, release.id), release);
		if (inputs.areaLookup) {
			this.areaSearchIndex = createAreaSearchIndex(inputs.areaLookup);
			for (const [releaseIdentity, areas] of inputs.areaLookup) {
				const [geography, boundaryRelease] = releaseIdentity.split("/", 2);
				if (!geography || !boundaryRelease) continue;
				for (const [code, area] of areas) {
					const key = `${geography}/${code}`;
					const candidates = this.sameCodeAreas.get(key) ?? [];
					candidates.push({
						id: areaId({ geography, boundaryRelease, code }),
						geography,
						boundaryRelease,
						...area,
						status: "same-code-continuity",
					});
					this.sameCodeAreas.set(key, candidates);
				}
			}
			for (const candidates of this.sameCodeAreas.values())
				candidates.sort((left, right) =>
					left.boundaryRelease.localeCompare(right.boundaryRelease),
				);
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
		return this.inputs.areaLookup?.get(releaseKey(geography, boundaryRelease));
	}

	countryIdentity(code: string) {
		for (const identity of [...(this.inputs.areaLookup?.keys() ?? [])]
			.filter((key) => key.startsWith("country/"))
			.sort()
			.reverse()) {
			const boundaryRelease = identity.slice("country/".length);
			const area = this.area({ geography: "country", boundaryRelease, code });
			if (area) return { id: areaKey("country", boundaryRelease, code), boundaryRelease, ...area };
		}
		return undefined;
	}

	places(query: string, limit: number) {
		if (!this.inputs.areaLookup) return [];
		if (!this.placeIndex)
			this.placeIndex = createPlaceIndex(this.inputs.areaLookup, this.inputs.namedLocationInventory);
		return resolvePlaces(this.placeIndex, query, limit);
	}

	hasAreaRelease(geography: string, boundaryRelease: string): boolean {
		return this.inputs.areaLookup?.has(releaseKey(geography, boundaryRelease)) ?? false;
	}

	areaCodes(geography: string, boundaryRelease: string): string[] | undefined {
		const areas = this.inputs.areaLookup?.get(releaseKey(geography, boundaryRelease));
		return areas ? [...areas.keys()] : undefined;
	}

	boundaryRelease(geography: string, id: string) {
		return this.boundaryReleases.get(releaseKey(geography, id));
	}

	boundaryReleasesFor(geography?: string): BoundaryRegistry["releases"] {
		return (geography
			? [...this.boundaryReleases.values()].filter(
				(release) => release.geography === geography,
			)
			: [...this.boundaryReleases.values()]) as BoundaryRegistry["releases"];
	}

	sameCode(identity: AreaIdentity): ResolvedSameCodeArea[] {
		return (this.sameCodeAreas.get(`${identity.geography}/${identity.code}`) ?? []).filter(
			({ boundaryRelease }) => boundaryRelease !== identity.boundaryRelease,
		);
	}

	explainAreaAbsence(geography: string, boundaryRelease: string, code: string): AreaAbsence | undefined {
		return this.inputs.boundaryRegistry
			? explainAreaAbsence(this.inputs.boundaryRegistry, this.inputs.areaInventory, this.inputs.areaLookup, geography, boundaryRelease, code)
			: undefined;
	}

	validateAreas(geography: string, boundaryRelease: string, values: string[]): { values: ValidatedValue[]; summary: ReturnType<typeof summariseBatch> } | undefined {
		if (!this.inputs.areaLookup?.has(releaseKey(geography, boundaryRelease))) return undefined;
		const validated = validateBatch(this.inputs.areaLookup, geography, boundaryRelease, values);
		return { values: validated, summary: summariseBatch(validated) };
	}

	selectReleaseForDate(geography: string, month: string, country?: string): ReleaseSelection | undefined {
		return this.inputs.boundaryRegistry
			? selectReleaseForDate(this.inputs.boundaryRegistry, geography, month, country, this.derivedSources)
			: undefined;
	}

	searchAreas(query: { geography?: string | null; boundaryRelease?: string | null; query?: string }) {
		return this.areaSearchIndex ? searchAreas(this.areaSearchIndex, query) : [];
	}
}
