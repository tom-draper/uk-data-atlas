// Statically bundled per-ward land area (km²), keyed by ward code. Lets population
// density be a code lookup instead of a runtime polygon-area computation, so the
// density chart no longer needs ward geometry. See lib/data/wardAreas/build.ts.
import wardAreasJson from "@/data/precompiled/ward-areas.json";

const wardAreas = wardAreasJson as Record<string, number>;

export const wardAreaSqKm = (code: string | null | undefined): number =>
	code ? (wardAreas[code] ?? 0) : 0;
