import type { CompatibilityCandidate } from "@uk-data-atlas/measures";

const STATUS_RANK: Record<CompatibilityCandidate["status"], number> = {
	"exact-code-set": 0,
	"code-set-compatible": 1,
	"partial-code-overlap": 2,
	"no-code-overlap": 3,
};

/** Candidate releases best first, without those sharing no code. */
export const rankReleases = (candidates: CompatibilityCandidate[]) =>
	[...candidates]
		.filter((candidate) => candidate.status !== "no-code-overlap")
		.sort(
			(left, right) =>
				STATUS_RANK[left.status] - STATUS_RANK[right.status] ||
				right.matchedSourceShare - left.matchedSourceShare ||
				left.boundaryRelease.localeCompare(right.boundaryRelease),
		);
