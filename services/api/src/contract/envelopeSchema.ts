import { z } from "zod";

/**
 * The envelope every data answer is wrapped in. The data member is checked
 * against the schema given, and any member the contract does not name passes.
 */
export const envelopeSchema = (data: z.ZodType) =>
	z.looseObject({
		apiVersion: z.literal("v1"),
		atlasRelease: z.string(),
		meta: z.looseObject({ nextCursor: z.string().nullable() }),
		data,
	});
