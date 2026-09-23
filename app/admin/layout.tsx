import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { getAppContext } from "@/lib/appContext";
import { AdminNav } from "@/components/admin/admin-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";

export const dynamic = "force-dynamic";

/** SPEC §19 — separate admin layout, guarded by profiles.role = 'admin'. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  if (!ctx.isAdmin) redirect("/app");
  return (
    <div className="flex min-h-screen">
      <aside className="bg-sidebar flex w-56 shrink-0 flex-col border-r p-3">
        <div className="mb-4 flex items-center gap-2 px-2 font-semibold">
          <Logo className="size-6" /> Admin
        </div>
        <AdminNav />
        <div className="mt-auto flex items-center justify-between px-2">
          <Link href="/app" className="text-muted-foreground inline-flex items-center gap-1 text-xs hover:underline">
            <ArrowLeftIcon className="size-3" /> Back to app
          </Link>
          <ThemeToggle />
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
