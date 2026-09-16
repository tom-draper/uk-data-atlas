import { createHash } from "node:crypto";
import type { CrosswalkInventory } from "./crosswalkInventory";

export type RelationshipPurpose = "identity" | "membership" | "apportion";

export type RelationshipPath = {
	id: string;
	purpose: RelationshipPurpose;
	from: { geography: string; boundaryRelease: string };
	to: { geography: string; boundaryRelease: string };
	quality: "publisher-supplied" | "derived";
	steps: Array<{
		crosswalkId: string;
		direction: "forward" | "reverse";
		method: "official-lookup" | "clean-containment" | "area-overlap";
	}>;
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

const purposeFor = (
	crosswalk: CrosswalkInventory["crosswalks"][number],
): RelationshipPurpose | undefined =>
	crosswalk.relationshipPurpose ??
	(crosswalk.method === "official-lookup"
		? "identity"
		: crosswalk.method === "clean-containment"
			? "membership"
			: crosswalk.method === "area-overlap"
				? "apportion"
				: undefined);

/**
 * Compiles only already-published one-edge paths. Multi-edge paths must be
 * declared and validated separately; they are never inferred from graph shape.
 */
export const compileRelationshipPaths = (
	crosswalks: CrosswalkInventory,
	approved: ApprovedRelationshipPath[] = [],
): RelationshipPathInventory => {
	const direct = crosswalks.crosswalks.flatMap((crosswalk) => {
		const purpose = purposeFor(crosswalk);
		if (!purpose) return [];
		const path = (
			direction: "forward" | "reverse",
		): RelationshipPath => ({
			id: `${crosswalk.id}/${direction}/${purpose}`,
			purpose,
			from: direction === "forward" ? crosswalk.from : crosswalk.to,
			to: direction === "forward" ? crosswalk.to : crosswalk.from,
			quality: crosswalk.quality,
			steps: [
				{ crosswalkId: crosswalk.id, direction, method: crosswalk.method },
			],
		});
		return [path("forward"), path("reverse")];
	});
	const edgeById = new Map(direct.map((path) => [path.id, path]));
	const composed = approved.map((declaration) => {
		if (declaration.steps.length < 2) {
			throw new Error(`${declaration.id}: a composed path needs at least two steps.`);
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
				throw new Error(`${declaration.id}: step ${index} does not start where the previous step ends.`);
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
			steps: steps.flatMap((step) => step.steps),
		} satisfies RelationshipPath;
	});
	const paths = [...direct, ...composed];
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
