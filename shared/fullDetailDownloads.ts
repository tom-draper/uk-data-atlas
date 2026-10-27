import type { AreaGeometryCache } from "./areaGeometry";
import type { GeographyResolver } from "./geographyResolver";
import {
	buildFullDetailParquet,
	buildFullDetailParquetAsync,
	type FullDetailDownload,
	type FullDetailRelease,
} from "./mapResource/fullDetail";

/** Bytes of built downloads kept for the next request. */
export const DEFAULT_FULL_DETAIL_CACHE_BYTES = 64 * 1024 * 1024;

export type FullDetailResult =
	| { status: "built"; body: Buffer }
	/** The release's areas or geometry are not what the build published. */
	| { status: "stale" }
	| { status: "unavailable" };

type Request = [
	geography: string,
	boundaryRelease: string,
	topology: FullDetailRelease["topology"],
	contentHash: string,
];

/**
 * What a route asks for a full-tier download. `build` is for a server, which
 * awaits the download rather than building it while every other request
 * waits.
 */
export type FullDetailSource = {
	get(...request: Request): FullDetailResult;
	build?(...request: Request): Promise<FullDetailResult>;
};

/**
 * Full-tier map downloads, built from the geometry store on request (see
 * `mapResource/fullDetail.ts`). The build published each one's hash, so a
 * download that no longer matches it, because the store or the area names
 * changed since, is refused rather than served under the old hash. The most
 * recent are kept, up to a byte budget, since a download is often retried or
 * fetched by several clients at once.
 */
export class FullDetailDownloads implements FullDetailSource {
	private readonly built = new Map<string, Buffer>();
	private readonly building = new Map<string, Promise<FullDetailResult>>();
	private bytes = 0;

	constructor(
		private readonly cache: AreaGeometryCache,
		private readonly resolver: Pick<
			GeographyResolver,
			"releaseAreas" | "boundaryRelease"
		>,
		private readonly maxBytes = DEFAULT_FULL_DETAIL_CACHE_BYTES,
	) {}

	/** A download already built, if it is still held. */
	held(...[geography, boundaryRelease, , contentHash]: Request) {
		const key = this.key(geography, boundaryRelease, contentHash);
		const body = this.built.get(key);
		if (!body) return undefined;
		this.built.delete(key);
		this.built.set(key, body);
		return { status: "built", body } as const;
	}

	/** The download, built here and now if it is not held. */
	get(...request: Request): FullDetailResult {
		const held = this.held(...request);
		if (held) return held;
		const release = this.release(...request);
		if (!release) return { status: "unavailable" };
		return this.keep(
			request,
			buildFullDetailParquet(this.cache, release.release, release.names),
		);
	}

	/**
	 * The download, built without holding up other requests for long. Callers
	 * asking for one already being built share that build.
	 */
	build(...request: Request): Promise<FullDetailResult> {
		const held = this.held(...request);
		if (held) return Promise.resolve(held);
		const [geography, boundaryRelease, , contentHash] = request;
		const key = this.key(geography, boundaryRelease, contentHash);
		const pending = this.building.get(key);
		if (pending) return pending;
		const release = this.release(...request);
		if (!release) return Promise.resolve({ status: "unavailable" });
		const started = buildFullDetailParquetAsync(
			this.cache,
			release.release,
			release.names,
		)
			.then((full) => this.keep(request, full))
			.finally(() => this.building.delete(key));
		this.building.set(key, started);
		return started;
	}

	private key(geography: string, boundaryRelease: string, hash: string) {
		return `${geography}/${boundaryRelease}\u0000${hash}`;
	}

	private release(...[geography, boundaryRelease, topology]: Request) {
		const release = this.resolver.boundaryRelease(
			geography,
			boundaryRelease,
		);
		const areas = this.resolver.releaseAreas(geography, boundaryRelease);
		if (!release || !areas) return undefined;
		return {
			release: {
				geography,
				boundaryRelease,
				attribution: `Contains ${release.source.publisher} data, ${release.source.licence.name}`,
				topology,
			} satisfies FullDetailRelease,
			names: new Map(
				[...areas.values()].map((area) => [area.code, area.name]),
			),
		};
	}

	private keep(
		[geography, boundaryRelease, , contentHash]: Request,
		full: FullDetailDownload | undefined,
	): FullDetailResult {
		if (!full) return { status: "unavailable" };
		if (full.contentHash !== contentHash) return { status: "stale" };
		const key = this.key(geography, boundaryRelease, contentHash);
		if (full.body.length <= this.maxBytes && !this.built.has(key)) {
			while (this.bytes + full.body.length > this.maxBytes) {
				const oldest = this.built.keys().next().value!;
				this.bytes -= this.built.get(oldest)!.length;
				this.built.delete(oldest);
			}
			this.built.set(key, full.body);
			this.bytes += full.body.length;
		}
		return { status: "built", body: full.body };
	}
}
