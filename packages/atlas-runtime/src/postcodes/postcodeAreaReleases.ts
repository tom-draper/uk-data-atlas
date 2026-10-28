import type { AreasResolver } from "../api/resolver/areas";
import type { MeasureCompatibilityInventory } from "../catalogue/measureCompatibility";
import { countryRelease } from "../areas/countryRelease";
import { DEFAULT_POSTCODE_GEOGRAPHIES } from "@uk-data-atlas/geography/postcode-defaults";
import { rankReleases } from "../areas/rankCompatibilityReleases";
import {
	releaseKey,
	type PostcodeAreaPurpose,
} from "@uk-data-atlas/geography/postcode-area-types";
import { compareCodeUnits } from "@uk-data-atlas/search-index";

/**
 * The releases worth compiling: those a postcode answer reads unless told
 * otherwise. A default lookup reads each default geography's release for the
 * directory's edition, and the country release settling a postcode that falls
 * in no area; a postcode value reads each measure source's best release that
 * has geometry. Each is chosen by the rule the answering route applies.
 */
export const postcodeAreaReleases = (
	resolver: Pick<
		AreasResolver,
		| "hasAreaRelease"
		| "selectReleaseForDate"
		| "boundaryRelease"
		| "boundaryReleasesFor"
	>,
	compatibility: MeasureCompatibilityInventory,
	edition: string,
	hasGeometry: (geography: string, boundaryRelease: string) => boolean,
): Array<{
	geography: string;
	boundaryRelease: string;
	purposes: PostcodeAreaPurpose[];
}> => {
	const chosen = new Map<
		string,
		{
			geography: string;
			boundaryRelease: string;
			purposes: Set<PostcodeAreaPurpose>;
		}
	>();
	const choose = (
		geography: string,
		boundaryRelease: string,
		purpose: PostcodeAreaPurpose,
	) => {
		if (
			!resolver.hasAreaRelease(geography, boundaryRelease) ||
			!hasGeometry(geography, boundaryRelease)
		)
			return false;
		const key = releaseKey(geography, boundaryRelease);
		const entry = chosen.get(key) ?? {
			geography,
			boundaryRelease,
			purposes: new Set(),
		};
		entry.purposes.add(purpose);
		chosen.set(key, entry);
		return true;
	};
	for (const geography of DEFAULT_POSTCODE_GEOGRAPHIES) {
		const selected = resolver.selectReleaseForDate(geography, edition);
		if (selected?.status === "selected")
			choose(geography, selected.selected.id, "default-lookup");
	}
	const country = countryRelease(resolver, edition);
	if (country) choose("country", country, "country");
	for (const measure of compatibility.measures)
		for (const source of measure.sources)
			for (const candidate of rankReleases(source.candidates)) {
				const release = resolver.boundaryRelease(
					source.sourceGeography.type,
					candidate.boundaryRelease,
				);
				if (
					release &&
					choose(
						source.sourceGeography.type,
						release.id,
						"measure-source",
					)
				)
					break;
			}
	return [...chosen.values()]
		.map((entry) => ({ ...entry, purposes: [...entry.purposes].sort() }))
		.sort((left, right) =>
			compareCodeUnits(
				releaseKey(left.geography, left.boundaryRelease),
				releaseKey(right.geography, right.boundaryRelease),
			),
		);
};
