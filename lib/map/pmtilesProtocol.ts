import { PMTiles, Protocol } from "pmtiles";

/** The one PMTiles protocol the map reads every archive through. */
export const pmtilesProtocol = new Protocol();

/**
 * Reads an archive's header and root directory ahead of the map, into the
 * cache the map reads them from, so a source added later starts on its tiles.
 * `url` is the archive's absolute URL, as the map is given it after
 * `pmtiles://`.
 */
export function prefetchPMTiles(url: string): Promise<void> {
	let archive = pmtilesProtocol.get(url);
	if (!archive) {
		archive = new PMTiles(url);
		pmtilesProtocol.add(archive);
	}
	return archive.getHeader().then(() => undefined);
}
