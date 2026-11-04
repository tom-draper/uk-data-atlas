import { sha256 } from "@uk-data-atlas/artifacts";
import type {
	PostcodeAreasArtifact,
	PostcodeAreasShard,
} from "@uk-data-atlas/geography/postcode-area-types";

/**
 * For each release, the earlier release whose distance most often equals its
 * own, or null when none ever does. Releases that share an area's geometry
 * give a postcode the same distance, so the later column can hold null there
 * and read the earlier value. Ties go to the earlier release, so the choice
 * is reproducible. Zero is not counted: it already stores in no bytes.
 */
export function chooseDistanceFallbacks(
	keys: string[],
	artifact: PostcodeAreasArtifact,
	readShard: (path: string) => string,
): Array<number | null> {
	const count = keys.length;
	const equal = new Float64Array(count * count);
	for (const entry of artifact.shards) {
		const text = readShard(entry.path);
		if (sha256(text) !== entry.contentHash)
			throw new Error(`Invalid postcode area shard ${entry.path}`);
		const shard: PostcodeAreasShard = JSON.parse(text);
		const columns = keys.map((key) => shard.releases[key]?.distanceCm);
		for (let later = 1; later < count; later++) {
			const distances = columns[later];
			if (!distances) continue;
			for (let earlier = 0; earlier < later; earlier++) {
				const other = columns[earlier];
				if (!other) continue;
				let matches = 0;
				for (let at = 0; at < distances.length; at++)
					if (distances[at] !== 0 && distances[at] === other[at])
						matches++;
				equal[later * count + earlier]! += matches;
			}
		}
	}
	return keys.map((_, later) => {
		let best: number | null = null;
		let most = 0;
		for (let earlier = 0; earlier < later; earlier++) {
			const matches = equal[later * count + earlier]!;
			if (matches > most) {
				best = earlier;
				most = matches;
			}
		}
		return best;
	});
}
