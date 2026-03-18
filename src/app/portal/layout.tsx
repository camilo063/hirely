/**
 * Public layout for candidate portal.
 * No sidebar, no auth. Mobile-first responsive.
 * Company name is rendered by the page itself (from token data).
 */
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-soft-gray flex flex-col">
      <main className="flex-1 max-w-2xl mx-auto w-full py-8 px-4">
        {children}
      </main>
      <footer className="text-center py-4 text-sm text-muted-foreground">
        Powered by Hirely
      </footer>
    </div>
  );
}
