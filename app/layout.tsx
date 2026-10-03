import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { SITE_URL } from "@/lib/atlas/structuredData";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const viewport: Viewport = {
	themeColor: "#ffffff",
	width: "device-width",
	initialScale: 1,
};

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: {
		default: "UK Data Atlas",
		// Pages write their own full titles.
		template: "%s",
	},
	description:
		"A powerful platform for visualizing data that shapes the UK. Explore interactive maps, demographics, and public sector insights across the United Kingdom.",
	authors: [{ name: "Tom Draper", url: SITE_URL }],
	creator: "Tom Draper",
	publisher: "Tom Draper",

	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			"max-video-preview": -1,
			"max-image-preview": "large",
			"max-snippet": -1,
		},
	},

	openGraph: {
		title: "UK Data Atlas",
		description:
			"A powerful platform for visualizing data that shapes the UK. Explore interactive maps and insights.",
		url: SITE_URL,
		siteName: "UK Data Atlas",
		locale: "en_GB",
		type: "website",
	},

	twitter: {
		card: "summary_large_image",
		title: "UK Data Atlas",
		description:
			"A powerful platform for visualizing data that shapes the UK.",
	},
	alternates: {
		canonical: "./",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className={inter.variable}>
			<body className="antialiased">{children}</body>
		</html>
	);
}
