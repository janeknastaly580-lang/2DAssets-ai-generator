"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  ["/admin", "Overview"],
  ["/admin/users", "Users"],
  ["/admin/workspaces", "Workspaces"],
  ["/admin/jobs", "Jobs"],
  ["/admin/costs", "Costs"],
  ["/admin/pricing", "Pricing"],
  ["/admin/flags", "Flags"],
  ["/admin/moderation", "Moderation"],
  ["/admin/audit", "Audit log"],
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {ITEMS.map(([href, label]) => (
        <Link key={href} href={href} className={cn("hover:bg-sidebar-accent rounded-md px-2.5 py-1.5 text-sm", (href === "/admin" ? pathname === href : pathname.startsWith(href)) && "bg-sidebar-accent font-medium")}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
