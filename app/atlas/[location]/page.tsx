import { notFound, redirect } from "next/navigation";
import {
	ATLAS_LOCATIONS,
	atlasHref,
	DEFAULT_ACTIVE_VIZ,
	findAtlasLocation,
} from "@/lib/atlas/pages";

export const dynamicParams = false;

export function generateStaticParams() {
	return ATLAS_LOCATIONS.map((location) => ({ location: location.slug }));
}

/** A location with no map opens on the atlas's default map. */
export default async function AtlasLocationPage({
	params,
}: {
	params: Promise<{ location: string }>;
}) {
	const location = findAtlasLocation((await params).location);
	if (!location) notFound();
	redirect(atlasHref(location.name, DEFAULT_ACTIVE_VIZ));
}
