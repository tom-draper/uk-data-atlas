import { createHash } from "node:crypto";

/** The `sha256:<hex>` form every artifact records its inputs and content in. */
export const sha256 = (content: string | Buffer) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;
