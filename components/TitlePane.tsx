"use client";
import { useIsDark } from "@/lib/context/ThemeContext";
import { panelTheme } from "@/lib/helpers/panelTheme";

export default function TitlePane() {
	const isDark = useIsDark();
	const t = panelTheme(isDark);

	return (
		<div
			className={`text-sm rounded-md backdrop-blur-md shadow-lg border relative ${t.panel}`}
		>
			<div className={`flex items-center ${t.section} rounded-t-md`}>
				<img
					src="/union-jack.png"
					alt="UK Data Atlas Logo"
					className="h-9 opacity-60 -m-px mr-3 rounded-r-md transform scale-x-[-1] cursor-pointer"
					style={{
						filter: "contrast(0.2) grayscale(1) brightness(1.8)",
					}}
				/>
				<h1 className={`font-semibold text-[15px] ${t.heading}`}>
					UK Data Atlas
				</h1>
			</div>
		</div>
	);
}
