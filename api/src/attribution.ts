import type { BoundaryRegistry } from "./boundaryRegistry";
import type { CrosswalkInventory } from "./crosswalkInventory";
import type { DataCatalog } from "./dataCatalog";
import { releaseKey } from "./geographyKeys";

export type Licence = { name: string; url?: string };

export type AttributedResource = {
	kind: "dataset" | "boundaryRelease" | "crosswalk";
	id: string;
	label: string;
	href: string;
	publisher?: string;
	sourceUrl?: string;
	licence?: Licence;
	/**
	 * Set on an artifact the Atlas compiled rather than obtained. Its terms come
	 * from the inputs listed here, which are attributed in their own right.
	 */
	derivedFrom?: string[];
};

export type AttributionRequest = {
	datasets: string[];
	measures: string[];
	boundaryReleases: string[];
	crosswalks: string[];
};

export type AttributionResult =
	| {
			status: "resolved";
			resources: AttributedResource[];
			licences: Licence[];
	  }
	| { status: "unknown"; unknownResources: string[] };

const licenceKey = (licence: Licence) => `${licence.name} ${licence.url ?? ""}`;

/**
 * Collect the publisher and licence of every resource behind an answer.
 *
 * Licence names are repeated exactly as the publisher gave them and are not
 * interpreted. One catalogue source already carries two licences across its
 * date range, and which terms govern a combined work is the caller's
 * judgement, not this API's.
 */
export const attributionFor = (
	request: AttributionRequest,
	dataCatalog: DataCatalog,
	boundarySource: BoundaryRegistry | BoundaryRegistry["releases"],
	crosswalkSource: CrosswalkInventory | CrosswalkInventory["crosswalks"],
): AttributionResult => {
	const boundaryReleases = Array.isArray(boundarySource)
		? boundarySource
		: boundarySource.releases;
	const crosswalks = Array.isArray(crosswalkSource)
		? crosswalkSource
		: crosswalkSource.crosswalks;
	const resources: AttributedResource[] = [];
	const unknown: string[] = [];

	const addDataset = (id: string, requestedAs: string) => {
		const dataset = dataCatalog.datasets.find(
			(candidate) => candidate.id === id,
		);
		if (!dataset) {
			unknown.push(requestedAs);
			return;
		}
		if (resources.some((resource) => resource.id === dataset.id)) return;
		resources.push({
			kind: "dataset",
			id: dataset.id,
			label: dataset.label,
			href: `/v1/datasets/${dataset.id}`,
			publisher: dataset.publisher,
			sourceUrl: dataset.sourceUrl,
			licence: dataset.licence,
		});
	};

	const addBoundaryRelease = (identity: string, requestedAs: string) => {
		const [geography, ...rest] = identity.split("/");
		const releaseId = rest.join("/");
		const release = boundaryReleases.find(
			(candidate) =>
				candidate.geography === geography && candidate.id === releaseId,
		);
		if (!release) {
			unknown.push(requestedAs);
			return;
		}
		const id = releaseKey(release.geography, release.id);
		if (resources.some((resource) => resource.id === id)) return;
		resources.push({
			kind: "boundaryRelease",
			id,
			label: release.title,
			href: `/v1/boundary-releases/${release.geography}/${release.id}`,
			publisher: release.source.publisher,
			sourceUrl: release.source.url,
			licence: release.source.licence,
		});
	};

	for (const id of request.datasets) addDataset(id, `dataset=${id}`);

	// A measure is attributed through the datasets its observations come from.
	for (const id of request.measures) {
		const measure = dataCatalog.measures.find(
			(candidate) => candidate.id === id,
		);
		if (!measure) {
			unknown.push(`measure=${id}`);
			continue;
		}
		for (const source of measure.sources)
			addDataset(source.datasetId, `measure=${id}`);
		// A derived measure's denominator is not one of its sources, but it is
		// just as much a part of the answer.
		for (const datasetId of measure.derivedFrom?.datasetIds ?? [])
			addDataset(datasetId, `measure=${id}`);
	}

	for (const identity of request.boundaryReleases)
		addBoundaryRelease(identity, `boundaryRelease=${identity}`);

	// A crosswalk is compiled by the Atlas from boundary files, so it carries no
	// licence of its own; its endpoints are attributed instead.
	for (const id of request.crosswalks) {
		const crosswalk = crosswalks.find((candidate) => candidate.id === id);
		if (!crosswalk) {
			unknown.push(`crosswalk=${id}`);
			continue;
		}
		const endpoints = [
			releaseKey(
				crosswalk.from.geography,
				crosswalk.from.boundaryRelease,
			),
			releaseKey(crosswalk.to.geography, crosswalk.to.boundaryRelease),
		];
		for (const endpoint of endpoints)
			addBoundaryRelease(endpoint, `crosswalk=${id}`);
		if (!resources.some((resource) => resource.id === crosswalk.id))
			resources.push({
				kind: "crosswalk",
				id: crosswalk.id,
				label: `${crosswalk.from.geography} to ${crosswalk.to.geography}, ${crosswalk.method}`,
				href: `/v1/crosswalks/${crosswalk.id}`,
				derivedFrom: endpoints,
			});
	}

	if (unknown.length > 0)
		return { status: "unknown", unknownResources: [...new Set(unknown)] };

	const licences = new Map<string, Licence>();
	for (const resource of resources) {
		if (resource.licence)
			licences.set(licenceKey(resource.licence), resource.licence);
	}

	return {
		status: "resolved",
		resources,
		licences: [...licences.values()].sort((left, right) =>
			left.name.localeCompare(right.name),
		),
	};
};

/** A plain-text block for a map corner, a report footer or a download README. */
export const attributionText = (
	resources: AttributedResource[],
	licences: Licence[],
	atlasRelease: string,
): string => {
	const named = (kind: AttributedResource["kind"]) =>
		resources
			.filter((resource) => resource.kind === kind)
			// An em dash rather than brackets: several release titles already
			// carry a parenthesised extent, and nesting reads badly.
			.map((resource) =>
				resource.publisher
					? `${resource.label} \u2014 ${resource.publisher}`
					: resource.label,
			);

	/**
	 * One entry per line once there is more than one. A publisher or licence
	 * name may itself contain a semicolon, where a source changed hands or
	 * changed terms partway through its date range, so joining inline would
	 * read as a single entry.
	 */
	const section = (heading: string, entries: string[]) => {
		if (entries.length === 0) return [];
		if (entries.length === 1) return [`${heading}: ${entries[0]}.`];
		return [`${heading}:`, ...entries.map((entry) => `- ${entry}`)];
	};

	return [
		...section("Data", named("dataset")),
		...section("Boundaries", named("boundaryRelease")),
		...section(
			"Crosswalks compiled by the UK Data Atlas",
			named("crosswalk"),
		),
		...section(
			licences.length === 1 ? "Licence" : "Licences",
			licences.map((licence) => licence.name),
		),
		`Compiled by the UK Data Atlas, release ${atlasRelease}.`,
	].join("\n");
};
