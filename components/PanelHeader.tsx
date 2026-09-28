"use client";
import { SelectedArea } from "@lib/types";
import { usePanelContext } from "@/lib/context/PanelContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import { gazetteer } from "@/lib/data/gazetteer/static";
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

function localAuthorityContext(
	code: string,
	data: Extract<SelectedArea, { type: "localAuthority" }>["data"],
) {
	if (!data) return { subtitle: "", regionCode: "" };

	const mappedRegion = gazetteer
		.ancestors(code)
		.find((area) => area.level === "region");
	const regionName = data.regionName || mappedRegion?.name || "";
	const regionCode = data.regionCode || mappedRegion?.code || "";

	return {
		subtitle: [regionName, data.countryName].filter(Boolean).join(", "),
		regionCode,
	};
}

export function panelHeaderDetails(
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
					selectedArea.data?.wardName ||
					selectedArea.name ||
					selectedArea.code,
				subtitle: selectedArea.data?.ladName ?? "",
				code: [selectedArea.data?.ladCode, selectedArea.code]
					.filter(Boolean)
					.join(" "),
			};
		case "constituency":
			return {
				title:
					selectedArea.data?.constituencyName ||
					selectedArea.name ||
					selectedArea.code,
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
		case "localAuthority": {
			const { subtitle, regionCode } = localAuthorityContext(
				selectedArea.code,
				selectedArea.data,
			);
			return {
				title:
					selectedArea.data?.ladName ||
					selectedArea.name ||
					selectedArea.code,
				subtitle,
				code: [regionCode, selectedArea.code].filter(Boolean).join(" "),
			};
		}
		case "lsoa":
			return {
				title:
					selectedArea.data?.lsoaName ||
					selectedArea.name ||
					selectedArea.code,
				subtitle: selectedArea.data?.ladName ?? "",
				code: [selectedArea.data?.ladCode, selectedArea.code]
					.filter(Boolean)
					.join(" "),
			};
		case "dataZone":
			return {
				title: selectedArea.name || selectedArea.code,
				subtitle: "",
				code: selectedArea.code,
			};
		case "superOutputArea":
			return {
				title: selectedArea.name || selectedArea.code,
				subtitle: "",
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
				<h2
					className={`text-sm font-semibold tracking-tight ${t.heading}`}
				>
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
