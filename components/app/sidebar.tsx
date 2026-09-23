"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BoxIcon,
  ChevronsUpDownIcon,
  CoinsIcon,
  CreditCardIcon,
  FolderIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  ListChecksIcon,
  LogOutIcon,
  MicIcon,
  MusicIcon,
  PlusIcon,
  SettingsIcon,
  ShieldIcon,
  SparklesIcon,
  Volume2Icon,
  WandIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar, Progress } from "@/components/ui/primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { post } from "@/lib/client/api";
import type { AppContext } from "@/lib/appContext";

const NAV = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboardIcon, exact: true },
  { href: "/app/projects", label: "Projects", icon: FolderIcon },
  {
    href: "/app/generate",
    label: "Generate",
    icon: WandIcon,
    children: [
      { href: "/app/generate/model_3d", label: "3D Model", icon: BoxIcon },
      { href: "/app/generate/audio_sfx", label: "SFX", icon: Volume2Icon },
      { href: "/app/generate/audio_music", label: "Music", icon: MusicIcon },
      { href: "/app/generate/audio_voice", label: "Voice", icon: MicIcon },
    ],
  },
  { href: "/app/library", label: "Library", icon: LibraryIcon },
  { href: "/app/jobs", label: "Jobs", icon: ListChecksIcon },
  { href: "/app/billing", label: "Billing", icon: CreditCardIcon },
  { href: "/app/settings", label: "Settings", icon: SettingsIcon },
];

export type SidebarContext = Pick<AppContext, "profile" | "avatarUrl" | "workspaces" | "balance" | "planPool" | "isAdmin"> & {
  workspace: { id: string; name: string; type: string; plan: string };
  role: string;
};

/** SPEC §17.4 — sidebar with workspace switcher, navigation, credit badge and account menu. */
export function Sidebar({ ctx }: { ctx: SidebarContext }) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(href + "/"));

  const switchWorkspace = async (id: string) => {
    if (id === ctx.workspace.id) return;
    try {
      await post(`/api/workspaces/${id}/switch`);
      router.push("/app");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const signOut = async () => {
    await post("/api/auth/logout");
    router.replace("/login");
    router.refresh();
  };

  const subUsed = Math.max(0, ctx.planPool - ctx.balance.subscription_available);
  const subPct = ctx.planPool ? (ctx.balance.subscription_available / ctx.planPool) * 100 : 0;
  const usage = ctx.balance.purchased_available + ctx.balance.trial_available;

  return (
    <aside className="bg-sidebar text-sidebar-foreground flex h-full w-64 shrink-0 flex-col border-r">
      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="hover:bg-sidebar-accent flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm cursor-pointer">
              <span className="bg-primary/15 text-primary inline-flex size-7 items-center justify-center rounded-md text-xs font-bold">{ctx.workspace.name.slice(0, 1).toUpperCase()}</span>
              <span className="flex-1 truncate">
                <span className="block truncate font-medium">{ctx.workspace.name}</span>
                <span className="text-muted-foreground block text-[11px] capitalize">
                  {ctx.workspace.type} · {ctx.workspace.plan === "none" ? "Free" : ctx.workspace.plan}
                </span>
              </span>
              <ChevronsUpDownIcon className="text-muted-foreground size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            {ctx.workspaces.map((w) => (
              <DropdownMenuItem key={w.id} onSelect={() => switchWorkspace(w.id)} className={cn(w.id === ctx.workspace.id && "bg-accent")}>
                <span className="truncate">{w.name}</span>
                <span className="text-muted-foreground ml-auto text-[10px] capitalize">{w.role}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/app/workspaces/new")}>
              <PlusIcon /> New team workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <nav className="flex-1 overflow-y-auto px-2">
        {NAV.map((item) => (
          <div key={item.href}>
            <Link
              href={item.children ? item.children[0].href : item.href}
              className={cn(
                "hover:bg-sidebar-accent flex items-center gap-2 rounded-md px-2.5 py-2 text-sm",
                isActive(item.href, item.exact) && !item.children && "bg-sidebar-accent font-medium",
              )}
            >
              <item.icon className="size-4" /> {item.label}
            </Link>
            {item.children && (
              <div className="mb-1 ml-4 border-l pl-2">
                {item.children.map((c) => (
                  <Link key={c.href} href={c.href} className={cn("hover:bg-sidebar-accent text-muted-foreground flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px]", isActive(c.href) && "bg-sidebar-accent text-foreground font-medium")}>
                    <c.icon className="size-3.5" /> {c.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="border-t p-3">
        <Link href="/app/billing" className="hover:bg-sidebar-accent block rounded-lg border p-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 font-medium">
              <CoinsIcon className="size-3.5" /> Credits
            </span>
            <span className="text-muted-foreground">{ctx.balance.available} available</span>
          </div>
          {ctx.planPool > 0 ? (
            <>
              <Progress value={subPct} className="mt-2 h-1.5" />
              <div className="text-muted-foreground mt-1">
                {ctx.balance.subscription_available} / {ctx.planPool} · +{usage} usage
              </div>
            </>
          ) : (
            <div className="text-muted-foreground mt-1">{usage ? `${usage} usage credits` : "No credits — buy a pack or start a trial"}</div>
          )}
          {subUsed > 0 && ctx.balance.available === 0 && <div className="text-destructive mt-1">Out of credits</div>}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="hover:bg-sidebar-accent mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm cursor-pointer">
              <Avatar src={ctx.avatarUrl} name={ctx.profile.display_name ?? ctx.profile.email} />
              <span className="flex-1 truncate">
                <span className="block truncate">{ctx.profile.display_name ?? ctx.profile.email}</span>
                <span className="text-muted-foreground block truncate text-[11px]">{ctx.profile.email}</span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onSelect={() => router.push("/app/settings")}>
              <SettingsIcon /> Settings
            </DropdownMenuItem>
            {ctx.isAdmin && (
              <DropdownMenuItem onSelect={() => router.push("/admin")}>
                <ShieldIcon /> Admin panel
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => router.push("/ai-disclosure")}>
              <SparklesIcon /> AI disclosure
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut} variant="destructive">
              <LogOutIcon /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
