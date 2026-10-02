"use client";

import { useState, type ReactNode } from "react";
import { useIsDark } from "@/lib/context/ThemeContext";
import { glassStyle } from "@/lib/helpers/panelTheme";
import GlassOverlays from "./GlassOverlays";
import PanelFooter from "./PanelFooter";
import PanelHeader from "./PanelHeader";

export function ChartPanelShell({
	children,
	cardsOnly = false,
}: {
	children: (settingsOpen: boolean) => ReactNode;
	/**
	 * Leaves out the header and footer, as in the mobile layout, which draws
	 * the header above the pinned card.
	 */
	cardsOnly?: boolean;
}) {
	const isDark = useIsDark();
	const [settingsOpen, setSettingsOpen] = useState(false);

	return (
		<div className="pointer-events-auto flex flex-col h-full w-full md:w-[320px] md:p-2.5">
			<div
				className={`rounded-md h-full flex flex-col relative overflow-hidden ${isDark ? "text-gray-100" : "text-gray-800"}`}
				style={glassStyle(isDark)}
			>
				<GlassOverlays isDark={isDark} />
				<div
					className="relative flex flex-col h-full"
					style={{ zIndex: 1 }}
				>
					{!cardsOnly && (
						<PanelHeader
							settingsOpen={settingsOpen}
							onToggleSettings={() =>
								setSettingsOpen((open) => !open)
							}
						/>
					)}
					{children(settingsOpen)}
					{!cardsOnly && <PanelFooter />}
				</div>
			</div>
		</div>
	);
}
