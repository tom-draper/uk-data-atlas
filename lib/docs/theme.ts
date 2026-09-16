import type { CSSProperties } from "react";
import { glassStyle } from "@/lib/helpers/panelTheme";

/**
 * The atlas glass panes, tuned for reading. The atlas panes sit over a busy
 * map and hold a few short labels; a docs page holds long prose, so the sheet
 * keeps the same edge highlights and blur with a denser frost behind the text.
 */

const lightGlass = glassStyle(false);

/** Chrome: header and sidebar, as see-through as the atlas panes. */
export const glassPane: CSSProperties = lightGlass;

/** The reading surface for page content. */
export const glassSheet: CSSProperties = {
	...lightGlass,
	background:
		"linear-gradient(160deg, rgba(255,255,255,0.66) 0%, rgba(255,255,255,0.5) 40%, rgba(236,241,250,0.44) 100%)",
};

/** A lighter card set on a sheet. */
export const glassCard: CSSProperties = {
	background:
		"linear-gradient(150deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.38) 100%)",
	border: "1px solid rgba(255,255,255,0.75)",
	boxShadow: [
		"inset 0 1px 0 rgba(255,255,255,0.9)",
		"0 1px 2px rgba(15,23,42,0.04)",
		"0 8px 24px rgba(15,23,42,0.06)",
	].join(", "),
};

/** The atlas dark smoked glass, deep enough to hold code on a bright page. */
export const smokedGlass: CSSProperties = {
	background:
		"linear-gradient(150deg, rgba(30,34,52,0.92) 0%, rgba(17,20,33,0.94) 55%, rgba(12,14,24,0.96) 100%)",
	backdropFilter: "blur(20px) saturate(160%)",
	WebkitBackdropFilter: "blur(20px) saturate(160%)",
	border: "1px solid rgba(255,255,255,0.10)",
	boxShadow: [
		"inset 0 1px 0 rgba(255,255,255,0.14)",
		"inset 1px 0 0 rgba(255,255,255,0.06)",
		"0 20px 60px rgba(15,23,42,0.28)",
		"0 4px 16px rgba(15,23,42,0.16)",
	].join(", "),
};
