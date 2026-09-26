import type { CSSProperties } from "react";
import { glassStyle } from "@/lib/helpers/panelTheme";

/**
 * Surfaces for the docs. Glass is kept for the one thing that floats over
 * the page, the header, as the atlas uses it for its panes over the map.
 * Reading happens on the canvas itself, with paper cards and ink code blocks.
 */

/**
 * The atlas glass pane, adapted for the docs header and menu. Its shorter
 * shadow keeps the floating navigation present without competing with text.
 */
export const glassPane: CSSProperties = {
	...glassStyle(false),
	boxShadow: [
		"inset 0 1px 0 rgba(255,255,255,0.85)",
		"inset 1px 0 0 rgba(255,255,255,0.6)",
		"inset -1px 0 0 rgba(0,0,0,0.04)",
		"inset 0 -1px 0 rgba(0,0,0,0.06)",
		"0 10px 32px rgba(0,0,0,0.10)",
		"0 2px 8px rgba(0,0,0,0.06)",
		"0 0 0 0.5px rgba(255,255,255,0.65)",
	].join(", "),
};

/** A light card resting on the canvas. */
export const paperCard: CSSProperties = {
	background: "rgba(255,255,255,0.72)",
	border: "1px solid rgba(15,23,42,0.07)",
	boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 6px 20px rgba(15,23,42,0.04)",
};

/** Code sits in dark ink, the atlas's dark pane colour made solid. */
export const inkPanel: CSSProperties = {
	background:
		"linear-gradient(150deg, #1c2030 0%, #151826 55%, #10121c 100%)",
	border: "1px solid rgba(15,23,42,0.5)",
	boxShadow: [
		"inset 0 1px 0 rgba(255,255,255,0.08)",
		"0 12px 32px rgba(15,23,42,0.14)",
	].join(", "),
};
