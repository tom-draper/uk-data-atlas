"use client";
import { createContext, useContext } from "react";

const ThemeContext = createContext(false);

export const ThemeProvider = ThemeContext.Provider;

export function useIsDark() {
	return useContext(ThemeContext);
}
