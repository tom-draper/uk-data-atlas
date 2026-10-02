/**
 * The one vocabulary every capability answer uses, so a caller asking "can
 * the Atlas give me this?" reads the same five words wherever it asks.
 *
 * - `available`: served directly, and completely for what was asked.
 * - `partial`: served directly, but only for part of what was asked.
 * - `requires-conversion`: not served directly, but a published conversion
 *   path answers it, and the answer names that path.
 * - `unsupported`: nothing the Atlas publishes answers it.
 * - `not-built`: this deployment has not built the artifact that would say.
 *
 * Every status but `available` carries a `reason`.
 */
export const CAPABILITY_STATUSES = [
	"available",
	"partial",
	"requires-conversion",
	"unsupported",
	"not-built",
] as const;

export type CapabilityStatus = (typeof CAPABILITY_STATUSES)[number];

export type Capability =
	| { status: "available"; reason?: string }
	| {
			status: Exclude<CapabilityStatus, "available">;
			reason: string;
	  };

export const notBuilt = (reason: string) =>
	({ status: "not-built", reason }) as const;

export const unsupported = (reason: string) =>
	({ status: "unsupported", reason }) as const;
