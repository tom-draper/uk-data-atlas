import { createHash } from "node:crypto";
import type {
	CrosswalkInventory,
	CrosswalkMethod,
} from "./crosswalkInventory";

export type RelationshipPurpose = "identity" | "membership" | "apportion";

export type RelationshipPath = {
	id: string;
	purpose: RelationshipPurpose;
	from: { geography: string; boundaryRelease: string };
	to: { geography: string; boundaryRelease: string };
	quality: "publisher-supplied" | "derived";
	/**
	 * `crosswalk` is one published crosswalk in either direction, `declared`
	 * a reviewed composition, and `discovered` a composition the build's path
	 * search found under the composition rules.
	 */
	origin: "crosswalk" | "declared" | "discovered";
	steps: Array<{
		crosswalkId: string;
		direction: "forward" | "reverse";
		method: CrosswalkMethod;
		/** What this step contributes, which can differ from the path's. */
		purpose: RelationshipPurpose;
	}>;
};

/**
 * Whether each source code of a crosswalk reaches exactly one target in each
 * direction, which decides whether a step can carry an identity or a sum.
 */
export type CrosswalkShape = { forward: boolean; reverse: boolean };

export const crosswalkShape = (artifact: {
	records: Array<{
		source: { code: string };
		targets: Array<{ code: string }>;
	}>;
}): CrosswalkShape => {
	const sourcesByTarget = new Map<string, number>();
	for (const record of artifact.records)
		for (const target of record.targets)
			sourcesByTarget.set(
				target.code,
				(sourcesByTarget.get(target.code) ?? 0) + 1,
			);
	return {
		forward: artifact.records.every(
			(record) => record.targets.length === 1,
		),
		reverse: [...sourcesByTarget.values()].every((count) => count === 1),
	};
};

/** The build's path search: the shape of each crosswalk, and a step limit. */
export type RelationshipPathDiscovery = {
	shapes: Map<string, CrosswalkShape>;
	maximumSteps: number;
};

export type RelationshipPathInventory = {
	schemaVersion: 1;
	contentHash: string;
	crosswalkInventoryHash: string;
	paths: RelationshipPath[];
};

export type ApprovedRelationshipPath = {
	id: string;
	purpose: RelationshipPurpose;
	steps: Array<{ crosswalkId: string; direction: "forward" | "reverse" }>;
};

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

/** The purpose a crosswalk declares, or the one its method implies. */
export const relationshipPurposeFor = (
	crosswalk: Pick<
		CrosswalkInventory["crosswalks"][number],
		"method" | "relationshipPurpose"
	>,
): RelationshipPurpose | undefined =>
	crosswalk.relationshipPurpose ??
	(crosswalk.method === "official-lookup"
		? "identity"
		: crosswalk.method === "clean-containment" ||
			  crosswalk.method === "geometric-containment"
			? "membership"
			: crosswalk.method === "area-overlap" ||
				  crosswalk.method === "population-overlap"
				? "apportion"
				: crosswalk.method === "same-code-continuity"
					? "identity"
					: undefined);

type Endpoint = { geography: string; boundaryRelease: string };

// Where a path under search stands: still an identity, summing up or listing
// down a hierarchy, or already past its one weighted step.
type SearchMode = "identity" | "up" | "down" | "apportion";

const endpointKey = ({ geography, boundaryRelease }: Endpoint) =>
	`${geography}/${boundaryRelease}`;

const toKebabCase = (value: string) =>
	value.replaceAll(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

/**
 * The mode a path reaches by taking one more step, or undefined where the
 * step would break what the path claims. An identity step keeps a path's
 * mode only when it is one-to-one in its direction. One that merges but never
 * splits, as a local government reorganisation does, puts each old area
 * wholly inside a new one, so it is taken as a step up. Summing up and
 * listing down cannot mix, and a path takes at most one weighted step, after
 * which only steps that keep each area whole may follow.
 */
const nextMode = (
	mode: SearchMode,
	step: RelationshipPath["steps"][number],
	shape: CrosswalkShape | undefined,
): SearchMode | undefined => {
	const onward =
		shape?.[step.direction === "forward" ? "forward" : "reverse"] ?? false;
	const back =
		shape?.[step.direction === "forward" ? "reverse" : "forward"] ?? false;
	const orientation =
		step.purpose === "identity"
			? onward && back
				? undefined
				: onward
					? "up"
					: "none"
			: step.purpose === "membership"
				? step.direction === "forward"
					? "up"
					: "down"
				: "apportion";
	if (orientation === undefined) return mode;
	if (orientation === "none") return undefined;
	if (orientation === "up" && !onward) return undefined;
	if (orientation === "apportion")
		return mode === "identity" || mode === "up" ? "apportion" : undefined;
	if (mode === "identity") return orientation;
	if (mode === orientation) return mode;
	return mode === "apportion" && orientation === "up" ? mode : undefined;
};

const purposeOfMode = (mode: SearchMode): RelationshipPurpose =>
	mode === "up" || mode === "down" ? "membership" : mode;

/**
 * The cheapest composition from each release to every release it reaches,
 * for each purpose. A step costs one, and a derived step half as much again,
 * so a publisher's lookup is preferred to a derived one of the same length.
 * Ties break on the steps' ids, so the search is deterministic.
 *
 * An apportion path is kept once per weighting basis. A population weight is
 * the better estimate for anything that follows people, but its building
 * blocks may cover fewer sources than the area weight does, so neither may
 * replace the other: both are published, each with its own coverage.
 */
const discoverPaths = (
	edges: RelationshipPath[],
	{ shapes, maximumSteps }: RelationshipPathDiscovery,
): RelationshipPath[] => {
	const outgoing = new Map<string, RelationshipPath[]>();
	for (const edge of edges) {
		const key = endpointKey(edge.from);
		outgoing.set(key, [...(outgoing.get(key) ?? []), edge]);
	}
	type State = {
		node: string;
		endpoint: Endpoint;
		mode: SearchMode;
		/** The basis of the path's weighted step, once it has taken one. */
		weighting?: "area" | "population";
		cost: number;
		steps: RelationshipPath[];
		visited: Set<string>;
		order: string;
	};
	const discovered: RelationshipPath[] = [];
	const sources = [
		...new Map(edges.map((edge) => [endpointKey(edge.from), edge.from])),
	].sort(([left], [right]) => left.localeCompare(right));
	for (const [origin, originEndpoint] of sources) {
		const best = new Map<string, State>();
		const queue: State[] = [
			{
				node: origin,
				endpoint: originEndpoint,
				mode: "identity",
				cost: 0,
				steps: [],
				visited: new Set([origin]),
				order: "",
			},
		];
		const settled = new Set<string>();
		while (queue.length > 0) {
			queue.sort(
				(left, right) =>
					left.cost - right.cost ||
					left.order.localeCompare(right.order),
			);
			const state = queue.shift()!;
			const stateKey = `${state.node}|${state.mode}|${state.weighting ?? ""}`;
			if (settled.has(stateKey)) continue;
			settled.add(stateKey);
			if (state.steps.length > 1) {
				const target = `${state.node}|${purposeOfMode(state.mode)}|${state.weighting ?? ""}`;
				const held = best.get(target);
				if (
					!held ||
					state.cost < held.cost ||
					(state.cost === held.cost && state.order < held.order)
				)
					best.set(target, state);
			}
			if (state.steps.length >= maximumSteps) continue;
			for (const edge of outgoing.get(state.node) ?? []) {
				const next = endpointKey(edge.to);
				if (state.visited.has(next)) continue;
				const step = edge.steps[0]!;
				const mode = nextMode(
					state.mode,
					step,
					shapes.get(step.crosswalkId),
				);
				const weighting =
					step.method === "population-overlap"
						? "population"
						: step.method === "area-overlap"
							? "area"
							: state.weighting;
				if (!mode || settled.has(`${next}|${mode}|${weighting ?? ""}`))
					continue;
				queue.push({
					node: next,
					endpoint: edge.to,
					mode,
					weighting,
					cost: state.cost + (edge.quality === "derived" ? 1.5 : 1),
					steps: [...state.steps, edge],
					visited: new Set([...state.visited, next]),
					order: `${state.order}|${edge.id}`,
				});
			}
		}
		for (const state of best.values()) {
			const purpose = purposeOfMode(state.mode);
			const from = originEndpoint;
			const to = state.endpoint;
			discovered.push({
				id: `discovered/${toKebabCase(from.geography)}-${from.boundaryRelease}-to-${toKebabCase(to.geography)}-${to.boundaryRelease}/${purpose}${state.weighting ? `/by-${state.weighting}` : ""}`,
				purpose,
				from,
				to,
				quality: state.steps.some((step) => step.quality === "derived")
					? "derived"
					: "publisher-supplied",
				origin: "discovered",
				steps: state.steps.flatMap((step) => step.steps),
			});
		}
	}
	return discovered;
};

/**
 * Compiles every published crosswalk as a one-step path in each direction,
 * and the reviewed multi-step compositions declared alongside them. Given the
 * crosswalks' shapes, it also searches the graph for compositions that neither
 * covers, under the rules in `nextMode`; those are marked `discovered`, and a
 * crosswalk or declared path between the same releases for the same purpose
 * always takes their place.
 */
export const compileRelationshipPaths = (
	crosswalks: CrosswalkInventory,
	approved: ApprovedRelationshipPath[] = [],
	discovery?: RelationshipPathDiscovery,
): RelationshipPathInventory => {
	const direct = crosswalks.crosswalks.flatMap((crosswalk) => {
		const purpose = relationshipPurposeFor(crosswalk);
		if (!purpose) return [];
		const path = (direction: "forward" | "reverse"): RelationshipPath => ({
			id: `${crosswalk.id}/${direction}/${purpose}`,
			purpose,
			from: direction === "forward" ? crosswalk.from : crosswalk.to,
			to: direction === "forward" ? crosswalk.to : crosswalk.from,
			quality: crosswalk.quality,
			origin: "crosswalk",
			steps: [
				{
					crosswalkId: crosswalk.id,
					direction,
					method: crosswalk.method,
					purpose,
				},
			],
		});
		return [path("forward"), path("reverse")];
	});
	const edgeById = new Map(direct.map((path) => [path.id, path]));
	const composed = approved.map((declaration) => {
		if (declaration.steps.length < 2) {
			throw new Error(
				`${declaration.id}: a composed path needs at least two steps.`,
			);
		}
		const steps = declaration.steps.map((step) => {
			const path = edgeById.get(
				`${step.crosswalkId}/${step.direction}/${declaration.purpose}`,
			);
			if (!path) {
				throw new Error(
					`${declaration.id}: ${step.crosswalkId}/${step.direction} is not published for ${declaration.purpose}.`,
				);
			}
			return path;
		});
		for (let index = 1; index < steps.length; index += 1) {
			const previous = steps[index - 1]!;
			const next = steps[index]!;
			if (
				previous.to.geography !== next.from.geography ||
				previous.to.boundaryRelease !== next.from.boundaryRelease
			) {
				throw new Error(
					`${declaration.id}: step ${index} does not start where the previous step ends.`,
				);
			}
		}
		return {
			id: declaration.id,
			purpose: declaration.purpose,
			from: steps[0]!.from,
			to: steps.at(-1)!.to,
			quality: steps.some((step) => step.quality === "derived")
				? ("derived" as const)
				: ("publisher-supplied" as const),
			origin: "declared" as const,
			steps: steps.flatMap((step) => step.steps),
		} satisfies RelationshipPath;
	});
	const covered = new Set(
		[...direct, ...composed].map(
			(path) =>
				`${endpointKey(path.from)}|${endpointKey(path.to)}|${path.purpose}`,
		),
	);
	const discovered = discovery
		? discoverPaths(direct, discovery).filter(
				(path) =>
					!covered.has(
						`${endpointKey(path.from)}|${endpointKey(path.to)}|${path.purpose}`,
					),
			)
		: [];
	const paths = [...direct, ...composed, ...discovered];
	if (new Set(paths.map((path) => path.id)).size !== paths.length) {
		throw new Error("Relationship path ids must be unique.");
	}
	paths.sort((left, right) => left.id.localeCompare(right.id));
	const content = JSON.stringify({
		schemaVersion: 1,
		crosswalkInventoryHash: crosswalks.contentHash,
		paths,
	});
	return {
		schemaVersion: 1,
		contentHash: sha256(content),
		crosswalkInventoryHash: crosswalks.contentHash,
		paths,
	};
};

export const createRelationshipPathIndex = (
	inventory: RelationshipPathInventory,
) => {
	const index = new Map<string, RelationshipPath[]>();
	for (const path of inventory.paths) {
		const key = [
			path.from.geography,
			path.from.boundaryRelease,
			path.to.geography,
			path.to.boundaryRelease,
			path.purpose,
		].join("/");
		const paths = index.get(key) ?? [];
		paths.push(path);
		index.set(key, paths);
	}
	return index;
};
