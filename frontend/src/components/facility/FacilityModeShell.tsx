"use client";

import { useEffect } from "react";
import { FacilityProvider } from "@/context/FacilityContext";
import { FacilityNav } from "./FacilityNav";

function FacilityChromeEffect() {
  useEffect(() => {
    document.documentElement.setAttribute("data-facility", "");
    return () => {
      document.documentElement.removeAttribute("data-facility");
    };
  }, []);
  return null;
}

export function FacilityModeShell({ children }: { children: React.ReactNode }) {
  return (
    <FacilityProvider>
      <FacilityChromeEffect />
      <FacilityNav />
      {children}
    </FacilityProvider>
  );
}

export function useFacilityChrome(active: boolean) {
  useEffect(() => {
    if (!active) return;
    document.documentElement.setAttribute("data-facility", "");
    return () => {
      document.documentElement.removeAttribute("data-facility");
    };
  }, [active]);
}
