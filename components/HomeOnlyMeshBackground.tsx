"use client";

import { usePathname } from "next/navigation";

export default function HomeOnlyMeshBackground() {
  const pathname = usePathname();
  
  // Only render on homepage
  if (pathname !== "/") return null;
  
  return (
    <div className="apple-mesh-bg" aria-hidden="true">
      <span className="apple-mesh-blob is-a1" />
      <span className="apple-mesh-blob is-a2" />
      <span className="apple-mesh-blob is-a3" />
    </div>
  );
}
