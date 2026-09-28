"use client";

import { useState, type ReactNode } from "react";
import { useIsDark } from "@/lib/context/ThemeContext";
import { glassStyle } from "@/lib/helpers/panelTheme";
import GlassOverlays from "./GlassOverlays";
import PanelFooter from "./PanelFooter";
import PanelHeader from "./PanelHeader";

export function ChartPanelShell({
	children,
}: {
	children: (settingsOpen: boolean) => ReactNode;
}) {
	const isDark = useIsDark();
	const [settingsOpen, setSettingsOpen] = useState(false);

	return (
		<div className="pointer-events-auto p-2.5 flex flex-col h-full w-[320px]">
			<div
				className={`rounded-md h-full flex flex-col relative overflow-hidden ${isDark ? "text-gray-100" : "text-gray-800"}`}
				style={glassStyle(isDark)}
			>
				<GlassOverlays isDark={isDark} />
				<div
					className="relative flex flex-col h-full"
					style={{ zIndex: 1 }}
				>
					<PanelHeader
						settingsOpen={settingsOpen}
						onToggleSettings={() =>
							setSettingsOpen((open) => !open)
						}
					/>
					{children(settingsOpen)}
					<PanelFooter />
				</div>
			</div>
		</div>
	);
}
