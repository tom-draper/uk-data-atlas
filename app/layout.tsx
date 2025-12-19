import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ukdataatlas.com";

export const viewport: Viewport = {
	themeColor: "#000000",
	width: "device-width",
	initialScale: 1,
};

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: {
		default: "UK Data Atlas",
		template: "UK Data Atlas",
	},
	description:
		"A powerful platform for visualizing data that shapes the UK. Explore interactive maps, demographics, and public sector insights across the United Kingdom.",
	keywords: [
		"UK Data Map",
		"UK Demographics Map",
		"UK Population Density",
		"Population Density",
		"House Price Map",
		"UK Crime Map",
		"Population Heat Map",
		"UK Census Data Map",
	],
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
		images: [
			{
				url: "/og-image.png",
				width: 1200,
				height: 630,
				alt: "UK Data Atlas Preview",
			},
		],
	},

	twitter: {
		card: "summary_large_image",
		title: "UK Data Atlas",
		description:
			"A powerful platform for visualizing data that shapes the UK.",
		images: ["/og-image.png"],
	},
	alternates: {
		canonical: "./",
	},
	icons: {
		icon: "/favicon.ico",
		shortcut: "/favicon-16x16.png",
		apple: "/apple-touch-icon.png",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className="antialiased">{children}</body>
		</html>
	);
}
