import {
	Callout,
	DocPage,
	EndpointRef,
	H2,
	List,
	P,
} from "@/components/docs/Content";
import { docsMetadata } from "@/lib/docs/metadata";

export const metadata = docsMetadata(
	"Atlas releases",
	"How UK Data Atlas API releases version every dataset, boundary and crosswalk, so any answer can be reproduced and cited exactly.",
	"/docs/concepts/releases",
);

export default function ReleasesPage() {
	return (
		<DocPage
			href="/docs/concepts/releases"
			eyebrow="Concepts"
			title="Atlas releases"
			lede="Everything behind the API, from datasets and boundaries to crosswalks and validation, is built into a single release with its own fingerprint. It's how you know two answers came from the same data, and how you get the same answer again later."
			toc={[
				{ id: "what", title: "What a release is" },
				{ id: "why", title: "Why it matters" },
				{ id: "pinning", title: "Pinning" },
				{ id: "endpoints", title: "Useful endpoints" },
			]}
		>
			<H2 id="what">What a release is</H2>
			<P>
				A release is identified by a hash, like `sha256:5c4aa452…`. It's
				calculated from the fingerprints of every file the Atlas
				publishes, so building from the same inputs always gives the
				same id, and any change gives a new one.
			</P>
			<P>
				Every response includes the release that produced it, as
				`atlasRelease`.
			</P>

			<H2 id="why">Why it matters</H2>
			<List
				items={[
					"**Consistency.** If two responses share an `atlasRelease`, they came from exactly the same data.",
					"**Reproducibility.** Record the release alongside a chart or report, and anyone can see precisely what it was built from.",
					"**Efficient syncing.** [Compare two releases](/docs/reference/sync/compare-atlas-releases) to see what changed, and refresh only that.",
				]}
			/>

			<H2 id="pinning">Pinning</H2>
			<P>
				Most URLs always serve the current release. Map resources can
				also be requested under a specific release, and those responses
				never change, so they can be cached permanently.
			</P>
			<Callout tone="warning">
				The server only holds the current release's data. Asking for an
				older one returns `410 Gone` rather than quietly giving you
				newer data, so keep your own copy of anything you pin.
			</Callout>

			<H2 id="endpoints">Useful endpoints</H2>
			<EndpointRef id="getAtlasRelease" />
			<EndpointRef id="compareAtlasReleases" />
			<EndpointRef id="getPinnedMapResource" />
		</DocPage>
	);
}
