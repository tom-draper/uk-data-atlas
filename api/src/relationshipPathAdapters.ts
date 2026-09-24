import { readFileSync } from "node:fs";
import type {
	ApprovedRelationshipPath,
	RelationshipPurpose,
} from "./relationshipPaths";

const purposes = ["identity", "membership", "apportion"] as const;
const directions = ["forward", "reverse"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const isPurpose = (value: unknown): value is RelationshipPurpose =>
	typeof value === "string" && purposes.some((purpose) => purpose === value);

const isDirection = (value: unknown): value is "forward" | "reverse" =>
	typeof value === "string" &&
	directions.some((direction) => direction === value);

/** Reads reviewed multi-hop paths; an empty list is a valid conservative start. */
export const readApprovedRelationshipPaths = (
	path: string,
): ApprovedRelationshipPath[] => {
	const value: unknown = JSON.parse(readFileSync(path, "utf8"));
	if (!isRecord(value) || !Array.isArray(value.paths))
		throw new Error(`Invalid relationship path adapters at ${path}`);
	const ids = new Set<string>();
	return value.paths.map((candidate, index) => {
		if (!isRecord(candidate))
			throw new Error(`${path}: path ${index} is invalid.`);
		if (
			typeof candidate.id !== "string" ||
			!candidate.id ||
			ids.has(candidate.id) ||
			!isPurpose(candidate.purpose) ||
			!Array.isArray(candidate.steps)
		) {
			throw new Error(`${path}: path ${index} is invalid.`);
		}
		ids.add(candidate.id);
		const steps = candidate.steps.map((step) => {
			if (!isRecord(step))
				throw new Error(
					`${path}: path ${candidate.id} has an invalid step.`,
				);
			if (
				typeof step.crosswalkId !== "string" ||
				!step.crosswalkId ||
				!isDirection(step.direction)
			)
				throw new Error(
					`${path}: path ${candidate.id} has an invalid step.`,
				);
			return {
				crosswalkId: step.crosswalkId,
				direction: step.direction,
			};
		});
		return {
			id: candidate.id,
			purpose: candidate.purpose,
			steps,
		};
	});
};
