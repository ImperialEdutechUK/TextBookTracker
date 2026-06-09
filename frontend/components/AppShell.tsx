'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

// Routes that should render without the application sidebar (e.g. the login page).
const FULL_WIDTH_ROUTES = ['/'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = FULL_WIDTH_ROUTES.includes(pathname);

  if (hideSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-content">
        <TopBar />
        {children}
      </div>
    </div>
  );
}
