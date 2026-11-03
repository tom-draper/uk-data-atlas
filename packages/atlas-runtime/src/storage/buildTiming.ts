/**
 * The one console style for every data build stage. It has no imports and
 * only erasable TypeScript, so plain `.mjs` scripts can load it too.
 *
 * Status lines are sentence case with no trailing full stop, results are in
 * the past tense, and nothing is decorated. Warnings and errors go to stderr.
 * Sizes, durations and counts always come from the formatters below.
 */

/**
 * A duration for a build log, never in milliseconds: `<0.1s`, `0.4s`, `4.2s`,
 * `42s`, `3m 07s` or `1h 02m`.
 */
export const formatDuration = (milliseconds: number) => {
	const ms = Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : 0;
	if (ms < 100) return "<0.1s";
	const tenths = Math.round(ms / 100);
	if (tenths < 100) return `${(tenths / 10).toFixed(1)}s`;
	const seconds = Math.round(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const pad = (value: number) => String(value).padStart(2, "0");
	if (seconds < 3600)
		return `${Math.floor(seconds / 60)}m ${pad(seconds % 60)}s`;
	return `${Math.floor(seconds / 3600)}h ${pad(Math.floor((seconds % 3600) / 60))}m`;
};

/** Milliseconds since a `performance.now()` reading. */
export const msSince = (startedAt: number) => performance.now() - startedAt;

export const elapsedSince = (startedAt: number) =>
	formatDuration(msSince(startedAt));

const BYTE_UNITS = ["B", "KB", "MB", "GB"] as const;

/**
 * A size for a build log, 1024-based with about three significant figures:
 * `512 B`, `4.2 KB`, `38 KB`, `7.2 MB`, `1.13 GB`. A non-empty file never
 * prints as `0 KB`.
 */
export const formatBytes = (bytes: number) => {
	let value = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
	let unit = 0;
	while (value >= 1023.5 && unit < BYTE_UNITS.length - 1) {
		value /= 1024;
		unit += 1;
	}
	if (unit === 0) return `${Math.round(value)} B`;
	const text =
		value >= 100
			? String(Math.round(value))
			: String(Number(value.toPrecision(3)));
	return `${text} ${BYTE_UNITS[unit]}`;
};

/** A compressed size: `7.2 MB gzip`. */
export const formatGzipBytes = (bytes: number) => `${formatBytes(bytes)} gzip`;

/** A count with thousands separators: `1,234,567`. */
export const formatCount = (count: number) => count.toLocaleString("en-GB");

export type ArtifactKind =
	"boundary" | "tiles" | "dataset" | "gazetteer" | "chunks";

export type ArtifactResult = {
	/** What happened to it: `compiled`, `cached`, `skipped` and so on. */
	status: string;
	bytes?: number;
	ms?: number;
};

/** `dataset: house-price.json (compiled, 7.2 MB, 5.9s)`. */
export const formatArtifact = (
	kind: ArtifactKind,
	name: string,
	{ status, bytes, ms }: ArtifactResult,
) => {
	const details = [
		status,
		bytes === undefined ? undefined : formatBytes(bytes),
		ms === undefined ? undefined : formatDuration(ms),
	].filter((detail) => detail !== undefined);
	return `${kind}: ${name} (${details.join(", ")})`;
};

export type BuildLog = {
	/** A status or result line on stdout. */
	info(message: string): void;
	/** `Warning: ...` on stderr. */
	warn(message: string): void;
	/** `Error: ...` on stderr. */
	error(message: string): void;
	/** One line per build artifact, the same shape whatever made it. */
	artifact(kind: ArtifactKind, name: string, result: ArtifactResult): void;
	/** Per-file noise, shown only when `DATA_BUILD_VERBOSE=1`. */
	detail(message: string): void;
};

export type BuildLogOutput = {
	out?: (line: string) => void;
	err?: (line: string) => void;
	verbose?: () => boolean;
};

export const createBuildLog = ({
	out = (line) => console.log(line),
	err = (line) => console.error(line),
	verbose = () => process.env.DATA_BUILD_VERBOSE === "1",
}: BuildLogOutput = {}): BuildLog => ({
	info: (message) => out(message),
	warn: (message) => err(`Warning: ${message}`),
	error: (message) => err(`Error: ${message}`),
	artifact: (kind, name, result) => out(formatArtifact(kind, name, result)),
	detail: (message) => {
		if (verbose()) out(message);
	},
});

export const buildLog: BuildLog = createBuildLog();

const REPOSITORY_ROOT = decodeURIComponent(
	new URL("../../../../", import.meta.url).pathname,
);

/** A path relative to the repository root, as build logs print them. */
export const repoPath = (path: string) =>
	path.startsWith(REPOSITORY_ROOT)
		? path.slice(REPOSITORY_ROOT.length)
		: path;
