import { DocPage, EndpointRef, H2, List, P } from "@/components/docs/Content";
import { docsMetadata } from "@/lib/docs/metadata";

export const metadata = docsMetadata(
	"Current Atlas release",
	"How UK Data Atlas API identifies the dataset, boundary and crosswalk artifacts behind its current responses.",
	"/docs/v1/concepts/releases",
);

export default function ReleasesPage() {
	return (
		<DocPage
			href="/docs/v1/concepts/releases"
			eyebrow="Concepts"
			title="Current Atlas release"
			lede="Everything behind the API, from datasets and boundaries to crosswalks and validation, is built into a single current release with its own fingerprint. It tells you exactly which artifacts produced an answer."
			toc={[
				{ id: "what", title: "What a release is" },
				{ id: "why", title: "Why it matters" },
				{ id: "availability", title: "Availability" },
				{ id: "endpoints", title: "Useful endpoints" },
			]}
		>
			<H2 id="what">What a release is</H2>
			<P>
				A release is identified by a hash, like `sha256:a1d2505a…`. It's
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
					"**Provenance.** Record the release alongside a chart or report, and anyone can see precisely which compiled artifacts it used.",
					"**Integrity.** The manifest records a hash for every published artifact.",
				]}
			/>

			<H2 id="availability">Availability</H2>
			<P>
				URLs serve the current release. A correction or preprocessing change
				replaces it with a newly compiled release; the API retains no earlier
				release data or runtime compatibility layer.
			</P>

			<H2 id="endpoints">Useful endpoints</H2>
			<EndpointRef id="getAtlasRelease" />
		</DocPage>
	);
}
