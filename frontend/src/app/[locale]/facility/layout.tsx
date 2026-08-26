"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { FacilityProvider, useFacility } from "@/context/FacilityContext";
import { FacilityNav } from "@/components/facility/FacilityNav";

function FacilityAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { state } = useFacility();
  const [mounted, setMounted] = useState(false);

  const isLoginPage = pathname.endsWith("/facility/login");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || isLoginPage) return;

    if (!state.authenticated) {
      const loginPath = pathname.replace(/\/facility\/.*$/, "/facility/login");
      router.replace(loginPath);
    }
  }, [mounted, state.authenticated, pathname, router, isLoginPage]);

  useEffect(() => {
    if (!isLoginPage) {
      document.documentElement.setAttribute("data-facility", "");
    }
    return () => {
      document.documentElement.removeAttribute("data-facility");
    };
  }, [isLoginPage]);

  if (!mounted && !isLoginPage) {
    return null;
  }

  if (!isLoginPage && !state.authenticated && mounted) {
    return null;
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {!isLoginPage && <FacilityNav />}
      <div className="flex-1 flex flex-col min-h-0">
        {children}
      </div>
    </div>
  );
}

export default function FacilityLayout({ children }: { children: React.ReactNode }) {
  return (
    <FacilityProvider>
      <FacilityAuthGuard>{children}</FacilityAuthGuard>
    </FacilityProvider>
  );
}
