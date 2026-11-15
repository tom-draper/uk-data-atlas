import { readFileSync } from "node:fs";
import { sha256Hex } from "../lib/hash.ts";

/**
 * What the payload generated from a direct-only dataset's rows must be, byte
 * for byte. Such a dataset has no compiler to compare against, so these are
 * the hash and size of the JSON its compiler wrote when it had one (the
 * statistics rows were proven to rebuild it exactly). Change one only when the
 * payload is meant to change.
 */
const GOLDENS: Record<string, { sha256: string; bytes: number }> = JSON.parse(
	readFileSync(
		new URL("./directPayloadGoldens.json", import.meta.url),
		"utf8",
	),
);

/** The reason a direct-only dataset's payload differs from its golden, if it does. */
export function directPayloadProblem(
	type: string,
	payload: string,
): string | undefined {
	const golden = GOLDENS[type];
	if (!golden)
		return `${type} has no compiler and no committed golden payload hash`;
	const sha256 = sha256Hex(payload);
	const bytes = Buffer.byteLength(payload, "utf8");
	return sha256 === golden.sha256 && bytes === golden.bytes
		? undefined
		: `${type}: the payload generated from its rows is ${sha256} (${bytes} bytes), not the golden ${golden.sha256} (${golden.bytes} bytes)`;
}
