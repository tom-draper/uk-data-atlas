import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/atlas/pages";

export const SHARE_CARD_SIZE = { width: 1200, height: 630 };

// The favicon's flag, read from the project root as Next's docs describe so
// the file is traced into the deployment.
const shareMark = `data:image/png;base64,${await readFile(
	join(process.cwd(), "lib/atlas/share-mark.png"),
	"base64",
)}`;

/** The preview image shown when a page is shared, in the site's colours. */
export function shareCard({
	title,
	detail,
	footer,
}: {
	title: string;
	detail?: string | null;
	footer?: string;
}) {
	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				justifyContent: "space-between",
				padding: "64px 72px",
				background: "#f3f3f1",
				color: "#0f172a",
				fontFamily: "sans-serif",
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 16,
					fontSize: 30,
					fontWeight: 600,
					color: "#334155",
				}}
			>
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img src={shareMark} width={66} height={40} alt="" />
				{SITE_NAME}
			</div>
			<div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
				<div
					style={{
						fontSize: title.length > 40 ? 64 : 76,
						fontWeight: 700,
						lineHeight: 1.08,
						letterSpacing: -1.5,
					}}
				>
					{title}
				</div>
				{detail && (
					<div
						style={{
							fontSize: 32,
							lineHeight: 1.4,
							color: "#475569",
						}}
					>
						{detail}
					</div>
				)}
			</div>
			<div style={{ display: "flex", fontSize: 24, color: "#64748b" }}>
				{footer ?? "ukdataatlas.com"}
			</div>
		</div>,
		SHARE_CARD_SIZE,
	);
}
