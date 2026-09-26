import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MultiPolygon } from "polygon-clipping";
import type { GeometrySourceLookup } from "./areaGeometry";
import type { AreaLookup } from "./areaInventory";
import {
	boundsIntersect,
	CLIPPING_VERSION,
	labelsFor,
	multiPolygonAreaM2,
	readGeometries,
	round,
	type AreaGeometry,
} from "./areaOverlap";
import { BoundedClipper, type ClipOperand } from "./boundedClipping";
import type { PopulationOverlapCrosswalkAdapter } from "./crosswalkAdapters";
import type {
	CrosswalkArtifact,
	PopulationOverlapCrosswalkArtifact,
} from "./crosswalkInventory";
import { validateEndpoint } from "./crosswalkValidation";

// About a millimetre, for a retry when polygon-clipping's sweep line fails.
const RETRY_PRECISION = 1e8;

// A block clips in well under a millisecond; one that runs this long has hit
// polygon-clipping's non-terminating case.
const CLIP_TIMEOUT_MS = 30_000;

const sha256 = (content: string | Buffer) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const multiPolygon = (geometry: AreaGeometry): MultiPolygon =>
	geometry.pieces.map((piece) => piece.geometry);

const roundedTo = (geometry: MultiPolygon, precision: number): MultiPolygon =>
	geometry.map((polygon) =>
		polygon.map((ring) =>
			ring.map(
				([x, y]) =>
					[
						Math.round(x * precision) / precision,
						Math.round(y * precision) / precision,
					] as [number, number],
			),
		),
	);

const boundsOf = (geometry: MultiPolygon): AreaGeometry["bounds"] => {
	const bounds: AreaGeometry["bounds"] = [
		Infinity,
		Infinity,
		-Infinity,
		-Infinity,
	];
	for (const [outer] of geometry)
		for (const [x, y] of outer!) {
			bounds[0] = Math.min(bounds[0], x);
			bounds[1] = Math.min(bounds[1], y);
			bounds[2] = Math.max(bounds[2], x);
			bounds[3] = Math.max(bounds[3], y);
		}
	return bounds;
};

/** Split one CSV line, honouring double-quoted fields. */
export const csvFields = (line: string) => {
	const fields: string[] = [];
	let field = "";
	let quoted = false;
	for (let index = 0; index < line.length; index += 1) {
		const character = line[index]!;
		if (quoted) {
			if (character === '"' && line[index + 1] === '"') {
				field += '"';
				index += 1;
			} else if (character === '"') quoted = false;
			else field += character;
		} else if (character === '"') quoted = true;
		else if (character === ",") {
			fields.push(field);
			field = "";
		} else field += character;
	}
	fields.push(field);
	return fields;
};

const readPopulation = (
	repositoryRoot: string,
	crosswalkId: string,
	{
		input,
		codeColumn,
		valueColumn,
	}: PopulationOverlapCrosswalkAdapter["population"],
) => {
	const content = readFileSync(join(repositoryRoot, "data", input));
	const [header, ...lines] = content
		.toString("utf8")
		.replace(/^\uFEFF/, "")
		.split(/\r?\n/)
		.filter((line) => line.length > 0);
	const columns = csvFields(header ?? "");
	const code = columns.indexOf(codeColumn);
	const value = columns.indexOf(valueColumn);
	if (code < 0 || value < 0)
		throw new Error(
			`${crosswalkId}: ${input} has no ${code < 0 ? codeColumn : valueColumn} column.`,
		);
	const population = new Map<string, number>();
	for (const [index, line] of lines.entries()) {
		const fields = csvFields(line);
		const count = Number(fields[value]);
		const area = fields[code]?.trim();
		if (!area || !Number.isFinite(count) || count < 0)
			throw new Error(
				`${crosswalkId}: ${input} row ${index + 2} has no usable ${codeColumn} and ${valueColumn}.`,
			);
		if (population.has(area))
			throw new Error(`${crosswalkId}: ${input} counts ${area} twice.`);
		population.set(area, count);
	}
	return { population, inputHash: sha256(content) };
};

/**
 * Reweight a published area-overlap crosswalk by resident population.
 *
 * An area weight assumes a source's people are spread evenly over its land,
 * and they rarely are: most of a rural constituency's area can hold few of its
 * residents. Here each building block's population is split among the source
 * and target pairs it falls in, in proportion to its area in each, so the
 * assumption of evenness shrinks from a whole source to one block, about 1,500
 * people for an LSOA.
 *
 * The pairs are the area-overlap crosswalk's own, which already settled which
 * overlaps are real and which are slivers where independently generalised
 * borders disagree. People a block puts into a source but none of its kept
 * targets are counted as `sliverPopulation`, not reassigned, and the build
 * fails if a source keeps less than `minimumCoverage` of its people.
 */
export const compilePopulationOverlapCrosswalk = (
	repositoryRoot: string,
	adapter: PopulationOverlapCrosswalkAdapter,
	geometrySources: GeometrySourceLookup,
	areaLookup: AreaLookup | undefined,
	pairs: CrosswalkArtifact | undefined,
): PopulationOverlapCrosswalkArtifact => {
	if (!pairs || pairs.method !== "area-overlap")
		throw new Error(
			`${adapter.id}: ${adapter.pairs} must be a compiled area-overlap crosswalk.`,
		);
	if (
		JSON.stringify(pairs.from) !== JSON.stringify(adapter.from) ||
		JSON.stringify(pairs.to) !== JSON.stringify(adapter.to)
	)
		throw new Error(
			`${adapter.id}: ${adapter.pairs} relates different releases.`,
		);
	let sourceCodePattern: RegExp | undefined;
	if (adapter.sourceCodePattern) {
		try {
			sourceCodePattern = new RegExp(adapter.sourceCodePattern);
		} catch {
			throw new Error(
				`${adapter.id}: sourceCodePattern is not a valid regular expression`,
			);
		}
	}
	const sources = readGeometries(
		repositoryRoot,
		adapter.id,
		adapter.from,
		geometrySources,
		sourceCodePattern,
	);
	const targets = readGeometries(
		repositoryRoot,
		adapter.id,
		adapter.to,
		geometrySources,
	);
	const blocks = readGeometries(
		repositoryRoot,
		adapter.id,
		adapter.weighting.blocks,
		geometrySources,
	);
	const { population, inputHash: populationHash } = readPopulation(
		repositoryRoot,
		adapter.id,
		adapter.population,
	);
	const uncounted = [...blocks.geometries.keys()].filter(
		(code) => !population.has(code),
	);
	const unmapped = [...population.keys()].filter(
		(code) => !blocks.geometries.has(code),
	);
	if (uncounted.length > 0 || unmapped.length > 0)
		throw new Error(
			`${adapter.id}: blocks and population disagree: ${uncounted.length} blocks have no count (${uncounted.slice(0, 5).join(", ")}), ${unmapped.length} counts have no block (${unmapped.slice(0, 5).join(", ")}).`,
		);

	const keptTargets = new Map<string, Map<string, number>>();
	for (const record of pairs.records) {
		if (!sources.geometries.has(record.source.code)) continue;
		keptTargets.set(
			record.source.code,
			new Map(
				record.targets.map((target) => [
					target.code,
					target.overlapAreaM2,
				]),
			),
		);
	}
	const sourceCodes = [...keptTargets.keys()].sort();
	const clipper = new BoundedClipper(CLIP_TIMEOUT_MS);
	for (const code of sourceCodes)
		clipper.register(
			`source/${code}`,
			multiPolygon(sources.geometries.get(code)!),
		);
	for (const code of new Set(
		[...keptTargets.values()].flatMap((kept) => [...kept.keys()]),
	))
		clipper.register(
			`target/${code}`,
			multiPolygon(targets.geometries.get(code)!),
		);

	// A failed clip is retried at a millimetre's precision; a registered
	// operand is rounded by clipping the rounded block against it.
	const intersectionAreaM2 = (
		block: MultiPolygon,
		other: ClipOperand,
	): { geometry: MultiPolygon; areaM2: number } | { reason: string } => {
		const first = clipper.clip("intersection", block, other);
		const clipped =
			first.status === "clipped"
				? first
				: clipper.clip(
						"intersection",
						roundedTo(block, RETRY_PRECISION),
						other,
					);
		return clipped.status === "clipped"
			? {
					geometry: clipped.geometry,
					areaM2: multiPolygonAreaM2(clipped.geometry),
				}
			: {
					reason:
						first.status === "failed"
							? `${first.reason} Retried at 1e-8 degrees: ${clipped.status === "failed" ? clipped.reason : ""}`
							: "",
				};
	};

	const sourcePopulation = new Map<string, number>();
	const pairPopulation = new Map<string, Map<string, number>>();
	const unmeasuredBlocks: PopulationOverlapCrosswalkArtifact["validation"]["population"]["unmeasuredBlocks"] =
		[];
	let blockPopulation = 0;
	let outsidePopulation = 0;
	try {
		for (const [blockCode, block] of [...blocks.geometries].sort(
			([left], [right]) => left.localeCompare(right),
		)) {
			const count = population.get(blockCode)!;
			blockPopulation += count;
			if (count === 0 || block.areaM2 <= 0) continue;
			const blockGeometry = multiPolygon(block);
			let placed = 0;
			let failure: string | undefined;
			for (const sourceCode of sourceCodes) {
				const source = sources.geometries.get(sourceCode)!;
				if (!boundsIntersect(block.bounds, source.bounds)) continue;
				const inSource = intersectionAreaM2(
					blockGeometry,
					`source/${sourceCode}`,
				);
				if ("reason" in inSource) {
					failure = inSource.reason;
					break;
				}
				if (inSource.areaM2 <= 0) continue;
				const share = Math.min(1, inSource.areaM2 / block.areaM2);
				placed += share;
				sourcePopulation.set(
					sourceCode,
					(sourcePopulation.get(sourceCode) ?? 0) + count * share,
				);
				const pieceBounds = boundsOf(inSource.geometry);
				for (const targetCode of keptTargets.get(sourceCode)!.keys()) {
					const target = targets.geometries.get(targetCode)!;
					if (!boundsIntersect(pieceBounds, target.bounds)) continue;
					const inPair = intersectionAreaM2(
						inSource.geometry,
						`target/${targetCode}`,
					);
					if ("reason" in inPair) {
						failure = inPair.reason;
						break;
					}
					if (inPair.areaM2 <= 0) continue;
					const byTarget =
						pairPopulation.get(sourceCode) ??
						new Map<string, number>();
					byTarget.set(
						targetCode,
						(byTarget.get(targetCode) ?? 0) +
							count * Math.min(1, inPair.areaM2 / block.areaM2),
					);
					pairPopulation.set(sourceCode, byTarget);
				}
				if (failure) break;
			}
			if (failure) {
				unmeasuredBlocks.push({
					code: blockCode,
					population: count,
					reason: failure,
				});
				continue;
			}
			outsidePopulation += count * Math.max(0, 1 - placed);
		}
	} finally {
		clipper.close();
	}

	// Every source's people, from every block, reach each target.
	const targetPopulation = new Map<string, number>();
	for (const byTarget of pairPopulation.values())
		for (const [code, people] of byTarget)
			targetPopulation.set(
				code,
				(targetPopulation.get(code) ?? 0) + people,
			);

	let assignedPopulation = 0;
	const coverage: Array<[string, number]> = [];
	const records = sourceCodes.map((sourceCode) => {
		const people = sourcePopulation.get(sourceCode) ?? 0;
		const byTarget = pairPopulation.get(sourceCode) ?? new Map();
		const kept = [...byTarget.values()].reduce(
			(sum, value) => sum + value,
			0,
		);
		if (people <= 0 || kept <= 0)
			throw new Error(
				`${adapter.id}: ${sourceCode} holds no population from ${adapter.weighting.blocks.geography}/${adapter.weighting.blocks.boundaryRelease}.`,
			);
		assignedPopulation += kept;
		coverage.push([sourceCode, kept / people]);
		return {
			source: {
				code: sourceCode,
				labels: labelsFor(
					adapter.id,
					areaLookup,
					adapter.from,
					sourceCode,
				),
				population: Math.round(people),
				coverage: round(Math.min(1, kept / people), 6),
			},
			targets: [...keptTargets.get(sourceCode)!]
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([targetCode, overlapAreaM2]) => {
					const pairPeople = byTarget.get(targetCode) ?? 0;
					return {
						code: targetCode,
						labels: labelsFor(
							adapter.id,
							areaLookup,
							adapter.to,
							targetCode,
						),
						weight: round(pairPeople / kept, 6),
						population: Math.round(pairPeople),
						sourceShare: round(Math.min(1, pairPeople / people), 6),
						targetShare: round(
							Math.min(
								1,
								pairPeople /
									(targetPopulation.get(targetCode) ?? 1),
							),
							6,
						),
						overlapAreaM2,
					};
				}),
		};
	});
	const below = coverage.filter(
		([, share]) => share < adapter.minimumCoverage,
	);
	if (below.length > 0)
		throw new Error(
			`${adapter.id}: ${below.length} sources keep less than ${adapter.minimumCoverage} of their population: ${below
				.slice(0, 10)
				.map(([code, share]) => `${code} (${share.toFixed(4)})`)
				.join(", ")}`,
		);
	const sliverPopulation =
		[...sourcePopulation.values()].reduce((sum, value) => sum + value, 0) -
		assignedPopulation;

	const artifactWithoutHash = {
		schemaVersion: 1 as const,
		id: adapter.id,
		method: adapter.method,
		quality: adapter.quality,
		weighting: adapter.weighting,
		from: {
			geography: adapter.from.geography,
			boundaryRelease: adapter.from.boundaryRelease,
		},
		to: {
			geography: adapter.to.geography,
			boundaryRelease: adapter.to.boundaryRelease,
		},
		provenance: {
			pairs: { crosswalkId: pairs.id, contentHash: pairs.contentHash },
			inputs: [
				{
					side: "from" as const,
					...sources.provenance,
					...(adapter.sourceCodePattern
						? { sourceCodePattern: adapter.sourceCodePattern }
						: {}),
				},
				{ side: "to" as const, ...targets.provenance },
			],
			blocks: blocks.provenance,
			population: {
				input: adapter.population.input,
				inputHash: populationHash,
				codeColumn: adapter.population.codeColumn,
				valueColumn: adapter.population.valueColumn,
			},
			areaProjection: "EPSG:6933" as const,
			clipping: `polygon-clipping@${CLIPPING_VERSION}`,
		},
		validation: {
			sourceNameConflicts: [],
			endpoints: {
				from: validateEndpoint(
					adapter.id,
					"from",
					adapter.from,
					new Set(records.map((record) => record.source.code)),
					areaLookup,
				),
				to: validateEndpoint(
					adapter.id,
					"to",
					adapter.to,
					new Set(
						records.flatMap((record) =>
							record.targets.map((target) => target.code),
						),
					),
					areaLookup,
				),
			},
			population: {
				minimumCoverage: adapter.minimumCoverage,
				blockCount: blocks.geometries.size,
				blockPopulation,
				assignedPopulation: Math.round(assignedPopulation),
				sliverPopulation: Math.round(sliverPopulation),
				outsidePopulation: Math.round(outsidePopulation),
				unmeasuredBlocks,
				minimumSourceCoverage: round(
					Math.min(...coverage.map(([, share]) => share)),
					6,
				),
			},
		},
		records,
	};
	return {
		...artifactWithoutHash,
		contentHash: sha256(JSON.stringify(artifactWithoutHash)),
	};
};
