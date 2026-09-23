import type { AreaInventory, AreaLookup, AreaRecord } from "../areaInventory";
import { explainAreaAbsence, type AreaAbsence } from "../areaAbsence";
import {
	summariseBatch,
	validateBatch,
	type ValidatedValue,
} from "../batchValidation";
import type { BoundaryRegistry } from "../boundaryRegistry";
import type { CrosswalkInventory } from "../crosswalkInventory";
import { crosswalksTo } from "../locationMembership";
import type {
	LocationProjectionStore,
	LocationProjection,
} from "../locationProjections";
import type {
	NamedLocation,
	NamedLocationInventory,
	NamedLocationLookup,
} from "../namedLocations";
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
	[geography, boundaryRelease, code].join("/");

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
	crosswalkInventory?: CrosswalkInventory;
	namedLocationInventory?: NamedLocationInventory;
	namedLocationLookup?: NamedLocationLookup;
	locationProjectionStore?: LocationProjectionStore;
};

/** Identity, release and location indexes over immutable compiled artifacts. */
export class AreasResolver {
	private readonly areaSearchIndex?: AreaSearchIndex;
	private readonly sameCodeAreas = new Map<string, ResolvedSameCodeArea[]>();
	private readonly locationsByMemberArea = new Map<string, NamedLocation[]>();
	private readonly boundaryReleases = new Map<
		string,
		BoundaryRegistry["releases"][number]
	>();
	private readonly derivedSources: Map<string, string>;
	private readonly crosswalksBySource = new Map<
		string,
		CrosswalkInventory["crosswalks"]
	>();

	constructor(private readonly inputs: AreasResolverInputs) {
		this.derivedSources = derivedReleaseSources(inputs.areaInventory);
		for (const release of inputs.boundaryRegistry?.releases ?? [])
			this.boundaryReleases.set(`${release.geography}/${release.id}`, release);
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
		for (const location of inputs.namedLocationInventory?.locations ?? [])
			for (const code of location.memberCodes) {
				const key = `${location.memberGeography}/${code}`;
				const locations = this.locationsByMemberArea.get(key) ?? [];
				locations.push(location);
				this.locationsByMemberArea.set(key, locations);
			}
		for (const locations of this.locationsByMemberArea.values())
			locations.sort((left, right) => left.id.localeCompare(right.id));
		for (const crosswalk of inputs.crosswalkInventory?.crosswalks ?? []) {
			const key = [
				crosswalk.from.geography,
				crosswalk.from.boundaryRelease,
				crosswalk.to.geography,
			].join("/");
			const candidates = this.crosswalksBySource.get(key) ?? [];
			candidates.push(crosswalk);
			this.crosswalksBySource.set(key, candidates);
		}
		for (const candidates of this.crosswalksBySource.values())
			candidates.sort((left, right) => left.id.localeCompare(right.id));
	}

	area(identity: AreaIdentity): AreaRecord | undefined {
		return this.inputs.areaLookup
			?.get(`${identity.geography}/${identity.boundaryRelease}`)
			?.get(identity.code);
	}

	hasAreaRelease(geography: string, boundaryRelease: string): boolean {
		return this.inputs.areaLookup?.has(`${geography}/${boundaryRelease}`) ?? false;
	}

	boundaryRelease(geography: string, id: string) {
		return this.boundaryReleases.get(`${geography}/${id}`);
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
		if (!this.inputs.areaLookup?.has(`${geography}/${boundaryRelease}`)) return undefined;
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

	namedLocation(id: string): NamedLocation | undefined { return this.inputs.namedLocationLookup?.get(id); }
	hasNamedLocationInventory(): boolean { return this.inputs.namedLocationInventory !== undefined; }
	namedLocationsForArea(identity: AreaIdentity): NamedLocation[] {
		return this.locationsByMemberArea.get(`${identity.geography}/${identity.code}`) ?? [];
	}
	locationProjection(locationId: string, geography: string, boundaryRelease: string, crosswalkId: string): LocationProjection | undefined {
		return this.inputs.locationProjectionStore?.get(locationId, geography, boundaryRelease, crosswalkId);
	}
	hasLocationProjectionStore(): boolean { return this.inputs.locationProjectionStore !== undefined; }
	locationMemberProjectionShards(memberGeography: string) {
		const summaries = new Map((this.inputs.crosswalkInventory?.crosswalks ?? []).map((summary) => [summary.id, summary]));
		return (this.inputs.locationProjectionStore?.memberProjectionShards() ?? []).flatMap((shard) => {
			const summary = summaries.get(shard.crosswalkId);
			return summary?.to.geography === memberGeography ? [{ shard, summary }] : [];
		});
	}
	locationParentProjectionShards(memberGeography: string) {
		const summaries = new Map((this.inputs.crosswalkInventory?.crosswalks ?? []).map((summary) => [summary.id, summary]));
		return (this.inputs.locationProjectionStore?.parentProjectionShards() ?? []).flatMap((shard) => {
			const summary = summaries.get(shard.crosswalkId);
			return summary?.from.geography === memberGeography ? [{ shard, summary }] : [];
		});
	}
	locationParentCrosswalks(geography: string, boundaryRelease: string) {
		return this.inputs.locationProjectionStore?.parentCrosswalks(geography, boundaryRelease) ?? [];
	}
	locationParents(locationId: string, crosswalkId: string) { return this.inputs.locationProjectionStore?.parents(locationId, crosswalkId); }
	crosswalksToLocationMembers(geography: string, boundaryRelease: string, memberGeography: string) {
		return this.crosswalksBySource.get([geography, boundaryRelease, memberGeography].join("/")) ??
			(this.inputs.crosswalkInventory ? crosswalksTo(this.inputs.crosswalkInventory, geography, boundaryRelease, memberGeography) : []);
	}
}
