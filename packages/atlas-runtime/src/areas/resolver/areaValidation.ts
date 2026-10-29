import { summariseBatch, type ValidatedValue } from "../batchValidation";
import { normalisePlaceName } from "@uk-data-atlas/geography";
import type { CrosswalkTranslator } from "@uk-data-atlas/relationships";
import type { AreasResolver, GeographyEndpoint } from "./areas";
import type { LineageResolver } from "./lineage";

export class AreaValidation {
	constructor(
		private readonly areas: Pick<
			AreasResolver,
			"validateAreas" | "areaReleases"
		>,
		private readonly lineage: Pick<LineageResolver, "relationships">,
		private readonly translator: Pick<CrosswalkTranslator, "paths">,
	) {}

	validateAreas(
		geography: string,
		boundaryRelease: string,
		values: string[],
		parents?: string[],
	) {
		const validated = this.areas.validateAreas(
			geography,
			boundaryRelease,
			values,
		);
		if (!validated || !parents) return validated;
		const endpoint = { geography, boundaryRelease };
		const resolved = validated.values.map((value, index) =>
			this.resolveParent(value, parents[index] ?? "", endpoint),
		);
		return { values: resolved, summary: summariseBatch(resolved) };
	}

	/**
	 * Ranks compiled releases by values that resolve exactly. The leading result
	 * is a likely interpretation, never an implicit conversion or a join.
	 */
	matchAreaValues(values: string[], parents?: string[]) {
		const candidates = this.areas
			.areaReleases()
			.map(({ geography, boundaryRelease }) => {
				const validated = this.validateAreas(
					geography,
					boundaryRelease,
					values,
					parents,
				);
				if (!validated) return undefined;
				const resolved = validated.values.filter(
					(value) =>
						value.status === "valid" || value.status === "matched",
				).length;
				return {
					geography,
					boundaryRelease,
					resolved,
					ambiguous: validated.values.filter(
						(value) => value.status === "ambiguous",
					).length,
					summary: validated.summary,
					values: validated.values,
				};
			})
			.filter(
				(candidate): candidate is NonNullable<typeof candidate> =>
					candidate !== undefined && candidate.resolved > 0,
			)
			.sort(
				(left, right) =>
					right.resolved - left.resolved ||
					left.ambiguous - right.ambiguous ||
					right.boundaryRelease.localeCompare(left.boundaryRelease) ||
					left.geography.localeCompare(right.geography),
			);
		const likely = candidates[0];
		const origins = likely
			? likely.values.flatMap((value) => {
					if (value.kind !== "code") return [];
					if ("presentIn" in value)
						return value.presentIn.map(({ boundaryRelease }) => ({
							geography: likely.geography,
							boundaryRelease,
						}));
					if ("heldBy" in value)
						return value.heldBy.flatMap(
							({ geography, boundaryReleases }) =>
								boundaryReleases.map((boundaryRelease) => ({
									geography,
									boundaryRelease,
								})),
						);
					return [];
				})
			: [];
		const recommendations = likely
			? [
					...new Map(
						origins.flatMap((from) =>
							(
								["identity", "membership", "apportion"] as const
							).flatMap((purpose) =>
								this.translator
									.paths(
										from,
										{
											geography: likely.geography,
											boundaryRelease:
												likely.boundaryRelease,
										},
										purpose,
									)
									.map((path) => [path.id, path] as const),
							),
						),
					).values(),
				]
			: [];
		const mixedCodeSystems = likely?.values.some(
			(value) =>
				value.kind === "code" &&
				(value.status === "other-geography" || "presentIn" in value),
		);
		// Releases that resolve the values exactly as well as the likely one,
		// which the values alone cannot tell apart; the newest leads only by
		// the sort, so they are named rather than passed over.
		const tiedWith = likely
			? candidates
					.slice(1)
					.filter(
						(candidate) =>
							candidate.resolved === likely.resolved &&
							candidate.ambiguous === likely.ambiguous,
					)
					.map(({ geography, boundaryRelease }) => ({
						geography,
						boundaryRelease,
					}))
			: [];
		return {
			likely: likely && {
				geography: likely.geography,
				boundaryRelease: likely.boundaryRelease,
				resolved: likely.resolved,
				summary: likely.summary,
				...(tiedWith.length > 0 ? { tiedWith } : {}),
			},
			candidates: candidates
				.slice(0, 10)
				.map(({ values: _values, ...candidate }) => candidate),
			values: likely?.values ?? [],
			verdict: !likely
				? "unmatched"
				: likely.summary.joinable
					? "joinable"
					: mixedCodeSystems
						? "mixed-code-systems"
						: "incomplete",
			recommendations,
		};
	}

	private resolveParent(
		value: ValidatedValue,
		parentValue: string,
		endpoint: GeographyEndpoint,
	): ValidatedValue {
		if (value.kind !== "name" || value.status !== "ambiguous") return value;
		const parent = parentValue.trim();
		if (!parent) return value;
		const parentCode = parent.toUpperCase();
		const parentName = normalisePlaceName(parent);
		const candidates = value.candidates.filter((candidate) => {
			const relationships = this.lineage.relationships(
				{ ...endpoint, code: candidate.code },
				"within",
			);
			return relationships.some(
				(relationship) =>
					relationship.counterpart.code === parentCode ||
					relationship.counterpart.labels.some(
						(label) => normalisePlaceName(label) === parentName,
					),
			);
		});
		if (candidates.length !== 1) return value;
		const candidate = candidates[0]!;
		const relationship = this.lineage
			.relationships({ ...endpoint, code: candidate.code }, "within")
			.find(
				(entry) =>
					entry.counterpart.code === parentCode ||
					entry.counterpart.labels.some(
						(label) => normalisePlaceName(label) === parentName,
					),
			)!;
		const { candidates: _candidates, ...base } = value;
		return {
			...base,
			kind: "name",
			status: "matched",
			match: candidate.match,
			area: {
				id: candidate.id,
				code: candidate.code,
				name: candidate.name,
			},
			parent: {
				value: parentValue,
				match:
					relationship.counterpart.code === parentCode
						? "code"
						: "name",
				area: {
					id: relationship.counterpart.id,
					code: relationship.counterpart.code,
					name:
						relationship.counterpart.labels[0] ??
						relationship.counterpart.code,
				},
				crosswalk: relationship.crosswalk.id,
			},
		};
	}
}
