import { parseDocsMode } from "@/lib/docs/mode";

describe("parseDocsMode", () => {
	it("keeps the docs off when the variable is unset", () => {
		expect(parseDocsMode(undefined)).toBe("off");
		expect(parseDocsMode("")).toBe("off");
	});

	it("accepts preview and public in any case", () => {
		expect(parseDocsMode("preview")).toBe("preview");
		expect(parseDocsMode(" PUBLIC ")).toBe("public");
	});

	it("treats an unrecognised value as off rather than publishing", () => {
		expect(parseDocsMode("true")).toBe("off");
		expect(parseDocsMode("pubilc")).toBe("off");
	});
});
