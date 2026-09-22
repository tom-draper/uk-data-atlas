import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AreaInventory, AreaReleaseArtifact } from "../src/areaInventory";
import { readShapefileFeatures } from "../src/shapefile";
import type { BoundaryRegistry } from "../src/boundaryRegistry";
import type { SameCodeContinuityCrosswalkAdapter } from "../src/crosswalkAdapters";
import type { CrosswalkInventory } from "../src/crosswalkInventory";

type Release = BoundaryRegistry["releases"][number] & {
	identity: string;
	month: string;
	codes: Set<string>;
};

// The area-overlap crosswalks' sliver width, so both methods agree on noise.
const SLIVER_WIDTH_M = 100;

const toKebabCase = (value: string) =>
	value.replaceAll(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

/**
 * Propose the same-code continuity adapters that chain each geography's
 * compiled releases in date order. Each month links to the next through its
 * widest-coverage release, and same-month variants link to that release. A
 * pair a publisher identity lookup already joins, or one sharing fewer than
 * half its codes, is skipped and reported. The compiler still decides which
 * shared codes become identity; this only chooses which releases to compare.
 */
export const proposeSameCodeContinuity = (repositoryRoot: string) => {
	const directory = join(repositoryRoot, "api", "public");
	const read = <T>(path: string) =>
		JSON.parse(readFileSync(join(directory, path), "utf8")) as T;
	const registry = read<BoundaryRegistry>("boundary-releases.json");
	const geometrySources = new Map(
		read<{
			releases: Array<{ id: string; status: string; input: string }>;
		}>("geometry-sources.json")
			.releases.filter((release) => release.status === "available")
			.map((release) => [release.id, release.input]),
	);
	// A registered source can still hold no shapes, such as a names-and-codes
	// table, and identity cannot be verified against it.
	const holdsGeometry = new Map<string, boolean>();
	const hasGeometry = (identity: string) => {
		const input = geometrySources.get(identity);
		if (!input) return false;
		if (!holdsGeometry.has(identity)) {
			const path = join(repositoryRoot, "data", input);
			const features = path.toLowerCase().endsWith(".shp")
				? readShapefileFeatures(path)
				: (
						JSON.parse(readFileSync(path, "utf8")) as {
							features: Array<{ geometry?: unknown }>;
						}
					).features;
			holdsGeometry.set(
				identity,
				features.length > 0 &&
					features.every(
						(feature) =>
							typeof feature.geometry === "object" &&
							feature.geometry !== null,
					),
			);
		}
		return holdsGeometry.get(identity)!;
	};
	const codes = new Map<string, Set<string>>();
	for (const release of read<AreaInventory>("area-inventory.json").releases) {
		if (release.status !== "available") continue;
		const artifact = read<AreaReleaseArtifact>(release.artifact);
		codes.set(
			`${release.geography}/${release.id}`,
			new Set(artifact.areas.map((area) => area.code)),
		);
	}
	const publishedIdentity = new Set(
		read<CrosswalkInventory>("crosswalk-inventory.json")
			.crosswalks.filter(
				(crosswalk) =>
					crosswalk.method !== "same-code-continuity" &&
					(crosswalk.relationshipPurpose ??
						(crosswalk.method === "official-lookup"
							? "identity"
							: undefined)) === "identity",
			)
			.flatMap((crosswalk) => {
				const from = `${crosswalk.from.geography}/${crosswalk.from.boundaryRelease}`;
				const to = `${crosswalk.to.geography}/${crosswalk.to.boundaryRelease}`;
				return [`${from}|${to}`, `${to}|${from}`];
			}),
	);
	const byGeography = new Map<string, Release[]>();
	for (const release of registry.releases) {
		const identity = `${release.geography}/${release.id}`;
		const releaseCodes = codes.get(identity);
		if (!geometrySources.has(identity) || !releaseCodes) continue;
		const releases = byGeography.get(release.geography) ?? [];
		releases.push({
			...release,
			identity,
			month: release.id.slice(0, 7),
			codes: releaseCodes,
		});
		byGeography.set(release.geography, releases);
	}
	const adapters: SameCodeContinuityCrosswalkAdapter[] = [];
	const skipped: string[] = [];
	for (const [geography, releases] of [...byGeography].sort(
		([left], [right]) => left.localeCompare(right),
	)) {
		const months = [
			...new Set(releases.map((release) => release.month)),
		].sort();
		const widest = (month: string) =>
			releases
				.filter((release) => release.month === month)
				.sort(
					(left, right) =>
						right.coverage.countries.length -
							left.coverage.countries.length ||
						right.codes.size - left.codes.size ||
						left.id.localeCompare(right.id),
				)[0]!;
		const pairs: Array<[Release, Release]> = [];
		for (const [index, month] of months.entries()) {
			const anchor = widest(month);
			if (index > 0) pairs.push([widest(months[index - 1]!), anchor]);
			for (const variant of releases
				.filter(
					(release) => release.month === month && release !== anchor,
				)
				.sort((left, right) => left.id.localeCompare(right.id)))
				pairs.push([anchor, variant]);
		}
		for (const [from, to] of pairs) {
			const shared = [...from.codes].filter((code) =>
				to.codes.has(code),
			).length;
			const withoutGeometry = [from, to].find(
				(release) => !hasGeometry(release.identity),
			);
			if (withoutGeometry) {
				skipped.push(
					`${from.identity} -> ${to.identity}: ${withoutGeometry.identity} holds no geometry to verify against`,
				);
				continue;
			}
			if (publishedIdentity.has(`${from.identity}|${to.identity}`)) {
				skipped.push(
					`${from.identity} -> ${to.identity}: a publisher identity lookup joins them`,
				);
				continue;
			}
			if (shared < Math.min(from.codes.size, to.codes.size) / 2) {
				skipped.push(
					`${from.identity} -> ${to.identity}: only ${shared} shared codes`,
				);
				continue;
			}
			adapters.push({
				id: `${toKebabCase(geography)}-${from.id}-to-${to.id}-same-code-continuity`,
				method: "same-code-continuity",
				quality: "derived",
				relationshipPurpose: "identity",
				weighting: { status: "not-applicable" },
				from: { geography, boundaryRelease: from.id },
				to: { geography, boundaryRelease: to.id },
				sliverWidthM: SLIVER_WIDTH_M,
			});
		}
	}
	return { adapters, skipped };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const { adapters, skipped } = proposeSameCodeContinuity(repositoryRoot);
	for (const reason of skipped) console.log(`Skipped ${reason}`);
	if (process.argv.includes("--write")) {
		const path = join(
			repositoryRoot,
			"api",
			"config",
			"crosswalk-adapters.json",
		);
		const file = JSON.parse(readFileSync(path, "utf8")) as {
			schemaVersion: 1;
			crosswalks: Array<{ method: string }>;
		};
		file.crosswalks = [
			...file.crosswalks.filter(
				(adapter) => adapter.method !== "same-code-continuity",
			),
			...adapters,
		];
		writeFileSync(path, `${JSON.stringify(file, null, "\t")}\n`);
		console.log(
			`Wrote ${adapters.length} same-code continuity adapters to ${path}`,
		);
	} else {
		console.log(JSON.stringify(adapters, null, "\t"));
	}
}
