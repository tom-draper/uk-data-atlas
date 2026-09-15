import { createHash } from "node:crypto";

/** A parsed file from the website's data/precompiled, keyed by period or edition. */
export type PrecompiledFile = Record<string, unknown>;

export const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

export const string = (value: unknown, context: string): string => {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${context} must be a non-empty string`);
	}
	return value;
};

export const number = (value: unknown, context: string): number => {
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
		throw new Error(`${context} must be a non-negative finite number`);
	}
	return value;
};

export const object = (
	value: unknown,
	context: string,
): Record<string, unknown> => {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(`${context} must be an object`);
	}
	return value as Record<string, unknown>;
};
