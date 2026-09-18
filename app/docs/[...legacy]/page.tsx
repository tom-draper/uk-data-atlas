import { redirect } from "next/navigation";

type Params = Promise<{ legacy: string[] }>;

export default async function LegacyDocsRedirect({
	params,
}: {
	params: Params;
}) {
	const { legacy } = await params;
	redirect(`/docs/v1/${legacy.join("/")}`);
}
