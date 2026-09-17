import { readFileSync } from "node:fs";
import type {
	ApprovedRelationshipPath,
	RelationshipPurpose,
} from "./relationshipPaths";

const purposes: RelationshipPurpose[] = ["identity", "membership", "apportion"];

/** Reads reviewed multi-hop paths; an empty list is a valid conservative start. */
export const readApprovedRelationshipPaths = (
	path: string,
): ApprovedRelationshipPath[] => {
	const value = JSON.parse(readFileSync(path, "utf8")) as { paths?: unknown };
	if (!Array.isArray(value.paths))
		throw new Error(`Invalid relationship path adapters at ${path}`);
	const ids = new Set<string>();
	return value.paths.map((candidate, index) => {
		if (typeof candidate !== "object" || candidate === null)
			throw new Error(`${path}: path ${index} is invalid.`);
		const entry = candidate as {
			id?: unknown;
			purpose?: unknown;
			steps?: unknown;
		};
		if (
			typeof entry.id !== "string" ||
			!entry.id ||
			ids.has(entry.id) ||
			!purposes.includes(entry.purpose as RelationshipPurpose) ||
			!Array.isArray(entry.steps)
		) {
			throw new Error(`${path}: path ${index} is invalid.`);
		}
		ids.add(entry.id);
		const steps = entry.steps.map((step) => {
			if (typeof step !== "object" || step === null)
				throw new Error(
					`${path}: path ${entry.id} has an invalid step.`,
				);
			const edge = step as { crosswalkId?: unknown; direction?: unknown };
			if (
				typeof edge.crosswalkId !== "string" ||
				!edge.crosswalkId ||
				!["forward", "reverse"].includes(edge.direction as string)
			)
				throw new Error(
					`${path}: path ${entry.id} has an invalid step.`,
				);
			return {
				crosswalkId: edge.crosswalkId,
				direction: edge.direction as "forward" | "reverse",
			};
		});
		return {
			id: entry.id,
			purpose: entry.purpose as RelationshipPurpose,
			steps,
		};
	});
};
