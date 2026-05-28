"use client";
import { createContext, use } from "react";

const ThemeContext = createContext(false);

export const ThemeProvider = ThemeContext.Provider;

export function useIsDark() {
	return use(ThemeContext);
}
