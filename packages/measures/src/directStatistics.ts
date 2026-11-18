import {
	periods,
	type DeclaredDataset,
	type DeclaredField,
	type DeclaredHeader,
	type DeclaredRelease,
	type DirectPart,
	type AreaRelationship,
} from "@uk-data-atlas/datasets";
import type {
	AreaIndex,
	AreaRelease,
	StatisticsDataset,
	StatisticsPeriod,
} from "./atlasStatistics.ts";
import {
	assembleStatistics,
	declaredMemberCodes,
	memberCode,
	type DeclaredManifestEntry,
} from "./declaredStatistics.ts";

/**
 * Statistics rows for a dataset read straight from its sources. The parts come
 * from the declaration's `direct.read`; everything else is as for a compiled
 * dataset: the same fields name the measures and dimensions, the same
 * assembly plans the series and the same writer stores them.
 *
 * Only what a single table of areas needs is supported: one record set, no
 * election text or discovered (undeclared) dimension parents.
 */
export function directStatistics(
	config: DeclaredDataset,
	parts: readonly DirectPart[],
	entry: DeclaredManifestEntry,
): (areas: AreaIndex) => StatisticsDataset {
	const type = config.type;
	if (!config.payload)
		throw new Error(
			`${type}: a direct dataset needs a payload declaration`,
		);
	if (config.election || (config.records && config.records.length !== 1))
		throw new Error(`${type}: a direct dataset has one record set`);
	const set = config.records?.[0] ?? {
		from: "data",
		release: config.release,
		alsoIn: config.alsoIn,
	};
	const measures = new Set(config.measures.map(({ slug }) => slug));
	const dimensions = new Set(
		(config.dimensions ?? []).map(({ slug }) => slug),
	);
	const declared = declaredMemberCodes(config);
	/** The dimensions a part's fields bind or fix, in the form a value names them. */
	const shapesOf = (fields: readonly DeclaredField[]) =>
		fields.map((field) => ({
			measure: field.measure,
			slugs: new Set([
				...Object.keys(field.members ?? {}),
				...field.path
					.split(".")
					.flatMap(
						(part) =>
							/^\{([a-z0-9-]+)\}$/.exec(part)?.slice(1) ?? [],
					)
					.filter((binding) => binding !== "period"),
			]),
			periods: field.path.includes("{period}"),
		}));
	const staticShapes =
		typeof config.fields === "function"
			? undefined
			: shapesOf(config.fields);
	const nameField =
		typeof config.name === "string"
			? config.name
			: typeof config.name === "function" || config.name === undefined
				? undefined
				: config.name[set.from];

	return (areas) => {
		const headerOf = (key: string): DeclaredHeader => {
			// A part named by a label ("2001-2003") is the one part it yields.
			const parts = config.payload!.parts([key]);
			const found =
				parts.find((part) => part.key === key) ??
				(parts.length === 1 ? parts[0] : undefined);
			if (!found)
				throw new Error(`${type}: the payload has no part ${key}`);
			return found.header;
		};
		const releasesOf = (header: DeclaredHeader): DeclaredRelease[] => [
			set.release
				? set.release(header)
				: {
						geography: String(header.boundaryType),
						year: Number(header.boundaryYear),
					},
			...(typeof set.alsoIn === "function"
				? set.alsoIn(header)
				: (set.alsoIn ?? [])),
		];
		const heldOf = (releases: DeclaredRelease[], context: string) => {
			const found = releases.flatMap((release) => {
				const match = areas.find(release.geography, release.year);
				return match ? [match] : [];
			});
			if (found.length === 0)
				throw new Error(
					`${context}: the atlas holds none of ${releases.map(({ geography, year }) => `${geography} ${year}`).join(", ")}`,
				);
			return found;
		};

		function* walk(
			onMember?: (dimension: string, key: string) => void,
			onName?: (release: AreaRelease, code: string, name: string) => void,
			onKey?: (release: AreaRelease, code: string, key: string) => void,
			onRelation?: (relation: {
				relation: AreaRelationship;
				period: string;
				child: { release: AreaRelease; code: string };
				parent: { release: AreaRelease; code: string };
			}) => void,
		) {
			for (const part of parts) {
				const context = `${type} ${part.key}`;
				const header = headerOf(part.key);
				const topPeriod: StatisticsPeriod = config.period
					? config.period(part.key, header)
					: /^\d{4}$/.test(part.key)
						? periods.year(Number(part.key))
						: (() => {
								throw new Error(
									`${context}: ${part.key} is not a year; declare its period`,
								);
							})();
				const shapes =
					staticShapes ??
					shapesOf(
						(
							config.fields as (
								key: string,
								header: DeclaredHeader,
							) => DeclaredField[]
						)(part.key, header),
					);
				const candidates = heldOf(releasesOf(header), context);
				const codeOf = (key: string) =>
					typeof config.keys === "function"
						? config.keys(key, header)
						: (config.keys?.[key] ?? key);
				for (const record of part.records) {
					const code = codeOf(record.code);
					const release = candidates.find((candidate) =>
						areas.has(candidate, code),
					);
					if (!release) {
						if (
							config.exclude?.some(({ codes }) =>
								codes.test(code),
							)
						)
							continue;
						throw new Error(
							`${context}: area ${code} is in no listed release`,
						);
					}
					if (nameField !== undefined && record.name !== undefined)
						onName?.(release, code, record.name);
					if (code !== record.code)
						onKey?.(release, code, record.code);
					for (const parent of config.parents ?? []) {
						if (!(parent.sets ?? [set.from]).includes(set.from))
							continue;
						const found = record.parents?.[parent.code];
						if (
							found === undefined ||
							(found === null && parent.nullable)
						)
							continue;
						if (
							!found ||
							(parent.name !== undefined &&
								typeof found.name !== "string")
						)
							throw new Error(
								`${context}: record ${code} has no ${[parent.code, parent.name].filter(Boolean).join(" and ")}`,
							);
						const parentRelease = heldOf(
							[parent.release, ...(parent.alsoIn ?? [])],
							context,
						).find((candidate) => areas.has(candidate, found.code));
						if (!parentRelease)
							throw new Error(
								`${context}: ${parent.code} ${found.code} is in no listed release`,
							);
						if (found.name !== undefined)
							onName?.(parentRelease, found.code, found.name);
						onRelation?.({
							relation: parent.relation ?? "parent",
							period: topPeriod.label,
							child: { release, code },
							parent: {
								release: parentRelease,
								code: found.code,
							},
						});
					}
					for (const value of record.values) {
						if (!measures.has(value.measure))
							throw new Error(
								`${context}: ${value.measure} is not a declared measure`,
							);
						const named = Object.keys(value.members ?? {});
						const fits = shapes.some(
							(shape) =>
								shape.measure === value.measure &&
								shape.slugs.size === named.length &&
								named.every((slug) => shape.slugs.has(slug)),
						);
						if (!fits)
							throw new Error(
								`${context}: ${value.measure} on ${named.join(", ") || "no dimension"} fits none of the declared fields`,
							);
						const members: Record<string, string> = {};
						for (const [slug, key] of Object.entries(
							value.members ?? {},
						)) {
							if (!dimensions.has(slug))
								throw new Error(
									`${type}: ${slug} is not a declared dimension`,
								);
							const codes = declared.get(slug);
							if (codes && !codes.has(key))
								throw new Error(
									`${context}: ${key} is not a declared ${slug}`,
								);
							onMember?.(slug, key);
							members[slug] = codes?.get(key) ?? memberCode(key);
						}
						if (value.value === null) continue;
						yield {
							measure: value.measure,
							members,
							release,
							code,
							period: value.period ?? topPeriod,
							value: value.value,
							lower: value.lower,
							upper: value.upper,
							status: value.status,
						};
					}
				}
				for (const link of config.headerRelationships ?? []) {
					const links = part.relationships?.[link.field];
					if (!links)
						throw new Error(`${context} has no ${link.field}`);
					const [childRelease] = heldOf([link.child], context);
					const [parentRelease] = heldOf([link.parent], context);
					for (const [child, parentKey] of Object.entries(links))
						onRelation?.({
							relation: link.relation ?? "parent",
							period: topPeriod.label,
							child: { release: childRelease!, code: child },
							parent: {
								release: parentRelease!,
								code: codeOf(parentKey),
							},
						});
				}
			}
		}
		return assembleStatistics(config, entry, walk);
	};
}
