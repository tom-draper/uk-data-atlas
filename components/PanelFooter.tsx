"use client";
import packageJson from "../package.json";
import Link from "next/link";
import { useIsDark } from "@/lib/context/ThemeContext";
import { panelTheme } from "@/lib/helpers/panelTheme";

export default function PanelFooter() {
	const version = packageJson.version;
	const isDark = useIsDark();
	const t = panelTheme(isDark);

	return (
		<div
			className={`text-[9px] px-2.5 pb-1.5 ${t.textMuted} ${t.section} pt-2 mt-auto flex`}
		>
			<a
				className="hover:underline cursor-pointer mr-auto"
				href="https://github.com/tom-draper/uk-data-atlas"
			>
				UK Data Atlas v{version}
			</a>
			<Link className="hover:underline cursor-pointer" href="/sources">
				View Sources
			</Link>
		</div>
	);
}
