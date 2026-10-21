import { decodeAgeArrays, encodeAgeArrays } from "./ageArrays";
import { decodeYearArrays, encodeYearArrays } from "./yearArrays";

/**
 * Compiled datasets are written to disk with their dense number maps as arrays,
 * and expanded again on reading. Each codec touches only the dataset types it
 * names, so a payload passes through the ones that do not apply unchanged.
 */

/** The payload as it is written to disk. */
export const encodeCompactPayload = (payload: unknown) =>
	encodeYearArrays(encodeAgeArrays(payload));

/** The payload as the browser and the compiler see it. */
export const decodeCompactPayload = (payload: unknown) =>
	decodeYearArrays(decodeAgeArrays(payload));
