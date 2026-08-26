"use client";

import { useEffect } from "react";
import { FacilityProvider } from "@/context/FacilityContext";
import { FacilityNav } from "./FacilityNav";
import { EmergencyBar } from "@/components/ui/EmergencyBar";

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
      <div className="flex flex-col h-full min-h-0">
        <FacilityNav />
        <div className="flex-1 flex flex-col min-h-0">{children}</div>
        <EmergencyBar />
      </div>
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
