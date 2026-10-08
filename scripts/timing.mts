/** A duration for a build log: `42ms`, `5.2s` or `3m 07s`. */
export const formatDuration = (milliseconds: number) => {
	if (milliseconds < 1000) return `${Math.round(milliseconds)}ms`;
	const seconds = milliseconds / 1000;
	if (seconds < 60) return `${seconds.toFixed(1)}s`;
	const minutes = Math.floor(seconds / 60);
	return `${minutes}m ${String(Math.round(seconds % 60)).padStart(2, "0")}s`;
};

export const elapsedSince = (startedAt: number) =>
	formatDuration(performance.now() - startedAt);

/** A size for a build log, in whole KB. */
export const formatKb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

/**
 * One line per build artifact, the same shape whatever made it:
 * `  dataset: house-price.json (compiled; 7344 KB; 5.9s)`. The kind says what
 * the artifact is, the details say what happened to it, then its size, then
 * how long that took.
 */
export const logArtifact = (
	kind: "boundary" | "dataset" | "gazetteer" | "chunks",
	name: string,
	details: readonly (string | undefined)[],
) =>
	console.log(
		`  ${kind}: ${name} (${details.filter((detail) => detail !== undefined).join("; ")})`,
	);
