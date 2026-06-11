"use client";
import { SelectedArea } from "@lib/types";
import { usePanelContext } from "@/lib/context/PanelContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import { panelTheme } from "@/lib/helpers/panelTheme";

function CogIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
		>
			<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
			<circle cx="12" cy="12" r="3" />
		</svg>
	);
}

function panelHeaderDetails(
	selectedLocation: string | null,
	selectedArea: SelectedArea | null,
) {
	if (selectedArea == null) {
		return {
			title: selectedLocation || "",
			subtitle: "United Kingdom",
			code: "",
		};
	}

	switch (selectedArea.type) {
		case "ward":
			return {
				title:
					selectedArea.name ??
					(selectedArea.data ? selectedArea.data.wardName : ""),
				subtitle: selectedArea.data
					? (selectedArea.data.ladName ?? "")
					: "",
				code: `${selectedArea.data ? (selectedArea.data.ladCode ?? "") : ""} ${selectedArea.code}`,
			};
		case "constituency":
			return {
				title:
					selectedArea.name ||
					(selectedArea.data?.constituencyName ?? ""),
				subtitle: selectedArea.data
					? [
							selectedArea.data.regionName,
							selectedArea.data.countryName,
						]
							.filter(Boolean)
							.join(", ")
					: "",
				code: selectedArea.code,
			};
		case "localAuthority":
			return {
				title: selectedArea.name || (selectedArea.data?.ladName ?? ""),
				subtitle: selectedArea.data
					? [
							selectedArea.data.regionName,
							selectedArea.data.countryName,
						]
							.filter(Boolean)
							.join(", ")
					: "",
				code: selectedArea.code,
			};
		case "lsoa":
			return {
				title: selectedArea.name || selectedArea.code,
				subtitle: "LSOA",
				code: selectedArea.code,
			};
		case "dataZone":
			return {
				title: selectedArea.name || selectedArea.code,
				subtitle: "Data Zone",
				code: selectedArea.code,
			};
		case "superOutputArea":
			return {
				title: selectedArea.name || selectedArea.code,
				subtitle: "Super Output Area",
				code: selectedArea.code,
			};
	}
}

export default function PanelHeader({
	settingsOpen,
	onToggleSettings,
}: {
	settingsOpen: boolean;
	onToggleSettings: () => void;
}) {
	const { selectedArea, selectedLocation } = usePanelContext();
	const isDark = useIsDark();
	const t = panelTheme(isDark);
	const { title, subtitle, code } = panelHeaderDetails(
		selectedLocation,
		selectedArea,
	);

	return (
		<div className={`pb-2 pt-2.5 px-2.5 ${t.section}`}>
			<div className="flex items-center justify-between">
				<h2 className={`font-semibold text-sm ${t.heading}`}>
					{title}
				</h2>
				<button
					type="button"
					onClick={onToggleSettings}
					className={`p-0.5 rounded transition-colors cursor-pointer ${settingsOpen ? "text-indigo-400" : `${t.textMuted} hover:${isDark ? "text-gray-200" : "text-gray-600"}`}`}
					title="Chart settings"
				>
					<CogIcon className="size-3.5" />
				</button>
			</div>
			<div className={`${t.textMuted} text-xs`}>
				{code ? (
					<div className="flex justify-between">
						<span>{subtitle}</span>
						<span>{code}</span>
					</div>
				) : (
					subtitle
				)}
			</div>
		</div>
	);
}
