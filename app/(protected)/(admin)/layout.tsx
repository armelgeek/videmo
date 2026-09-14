import { requireAdmin } from "@/lib/auth-utils";
import { getAccess } from "@/lib/permissions";
import { AppSidebar } from '@/components/organisms/sidebar/app-sidebar';
import { SiteHeader } from '@/components/organisms/header/site-header';
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const session = await requireAdmin();
  const access = await getAccess(session.user.id);

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar grantedPermissions={access.granted} />
      <SidebarInset>
        <SiteHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
