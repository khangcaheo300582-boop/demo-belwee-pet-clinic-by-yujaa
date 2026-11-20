"use client";

import { usePathname } from "next/navigation";
import ParticleDNAField from "./ParticleDNAField";

export default function HomeOnlyParticleDNA() {
  const pathname = usePathname();
  
  // Only render on homepage
  if (pathname !== "/") return null;
  
  return (
    <div className="fixed inset-0 z-[5] pointer-events-none" aria-hidden="true">
      <ParticleDNAField />
    </div>
  );
}
