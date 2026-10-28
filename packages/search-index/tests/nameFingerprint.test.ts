import { expect, it } from "vitest";
import { NAME_NORMALISATION } from "@uk-data-atlas/search-index/node";

it("preserves the fingerprint for existing search indexes", () => {
	expect(NAME_NORMALISATION).toBe(
		"sha256:b70381c386db63937d4e61bfe8d417d283306aa3e5ba2c3c6ab10f43e51eeaf2",
	);
});
