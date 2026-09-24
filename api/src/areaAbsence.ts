import type { AreaInventory, AreaLookup } from "./areaInventory";
import type { BoundaryRegistry } from "./boundaryRegistry";
import { releaseKey } from "./geographyKeys";
import {
	explainCodeInRelease,
	type MemberCodeStatus,
} from "./memberReconciliation";

/**
 * Why an area identity resolves to nothing, as explicitly as the compiled
 * artifacts allow.
 *
 * A code missing from a release is classified only by which other compiled
 * releases of the same geography hold it. That is evidence of when the code
 * was in use, not of what happened to the place: a `superseded` code may have
 * been abolished, merged or merely recoded, so none of those is claimed.
 */
export type AreaAbsence =
	| {
			code: "unsupported_geography";
			absence: "unknown-geography";
			detail: string;
			links: { geographies: string };
	  }
	| {
			code: "unsupported_geography";
			absence: "unknown-release";
			detail: string;
			availableReleases: Array<{ id: string; href: string }>;
	  }
	| {
			code: "unsupported_geography";
			absence: "release-not-compiled";
			detail: string;
			links: { boundaryRelease: string };
	  }
	| {
			code: "area_not_in_release";
			absence: MemberCodeStatus;
			detail: string;
			presentIn: Array<{
				boundaryRelease: string;
				name: string;
				href: string;
			}>;
	  };

const CODE_DETAIL: Record<MemberCodeStatus, string> = {
	superseded:
		"is held only by older releases of this geography, so it was no longer in use by this release. Whether the area was abolished, merged or recoded is not recorded here.",
	"not-yet-current":
		"is held only by newer releases of this geography, so it had not come into use by this release.",
	"absent-from-release":
		"is held by other releases of this geography but not this one, and those releases do not place its absence before or after this one.",
	unknown: "is held by no compiled release of this geography.",
};

export const explainAreaAbsence = (
	registry: BoundaryRegistry,
	areaInventory: AreaInventory | undefined,
	areaLookup: AreaLookup | undefined,
	geography: string,
	boundaryRelease: string,
	code: string,
): AreaAbsence => {
	const releases = registry.releases.filter(
		(release) => release.geography === geography,
	);
	if (releases.length === 0) {
		return {
			code: "unsupported_geography",
			absence: "unknown-geography",
			detail: `No boundary release is published for the geography ${geography}.`,
			links: { geographies: "/v1/geographies" },
		};
	}
	if (!releases.some((release) => release.id === boundaryRelease)) {
		return {
			code: "unsupported_geography",
			absence: "unknown-release",
			detail: `No ${geography} boundary release is published as ${boundaryRelease}.`,
			availableReleases: releases.map((release) => ({
				id: release.id,
				href: `/v1/boundary-releases/${geography}/${release.id}`,
			})),
		};
	}
	const releaseAreas = areaLookup?.get(
		releaseKey(geography, boundaryRelease),
	);
	if (!releaseAreas) {
		const inventoried = areaInventory?.releases.find(
			(release) =>
				release.geography === geography &&
				release.id === boundaryRelease,
		);
		return {
			code: "unsupported_geography",
			absence: "release-not-compiled",
			detail:
				inventoried?.status === "not-compiled"
					? `Area identities are not compiled for ${geography}/${boundaryRelease}: ${inventoried.reason}`
					: `Area identities are not compiled for ${geography}/${boundaryRelease}.`,
			links: {
				boundaryRelease: `/v1/boundary-releases/${geography}/${boundaryRelease}`,
			},
		};
	}
	const { status, presentIn } = explainCodeInRelease(
		areaLookup as AreaLookup,
		geography,
		boundaryRelease,
		code,
	);
	return {
		code: "area_not_in_release",
		absence: status,
		detail: `${code} ${CODE_DETAIL[status]}`,
		presentIn: presentIn.map((appearance) => ({
			boundaryRelease: appearance.boundaryRelease,
			name: appearance.name,
			href: `/v1/areas/${geography}/${appearance.boundaryRelease}/${code}`,
		})),
	};
};
