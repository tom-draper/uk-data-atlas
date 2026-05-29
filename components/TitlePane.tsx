"use client";
import Image from "next/image";
import { useIsDark } from "@/lib/context/ThemeContext";
import { panelTheme, glassStyle, glassSpecular } from "@/lib/helpers/panelTheme";


export default function TitlePane() {
	const isDark = useIsDark();
	const t = panelTheme(isDark);

	return (
		<div
			className={`text-sm rounded-md relative overflow-hidden ${isDark ? "text-gray-100" : "text-gray-800"}`}
			style={glassStyle(isDark)}
		>
			<div style={glassSpecular(isDark)} />
			<div className={`relative flex items-center ${t.section} rounded-t-md`} style={{ zIndex: 1 }}>
				<Image
					src="/union-jack.png"
					alt="UK Data Atlas Logo"
					width={72}
					height={36}
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
