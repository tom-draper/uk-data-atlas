// Statically bundled eager core. The core is small (~51 KB gz) and needed
// synchronously at map mount and in non-React modules (e.g. boundaries.ts), so
// it is imported rather than fetched. Crosswalk shards are loaded separately
// and lazily by lib/data/boundaries/constituencyLadOverlaps.ts.
import coreJson from "@/data/precompiled/gazetteer.core.json";
import { Gazetteer } from "./gazetteer";
import type { GazetteerCore } from "./types";

export const gazetteer = new Gazetteer(coreJson as unknown as GazetteerCore);
