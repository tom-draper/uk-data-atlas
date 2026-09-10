"use client";

import { useRef } from "react";
import { CodeMapperStore } from "../data/boundaries/codeMapper";

/** Provides one stable mapper instance for the lifetime of a map UI. */
export function useCodeMapper(): CodeMapperStore {
	const mapperRef = useRef<CodeMapperStore | null>(null);
	return (mapperRef.current ??= new CodeMapperStore());
}
