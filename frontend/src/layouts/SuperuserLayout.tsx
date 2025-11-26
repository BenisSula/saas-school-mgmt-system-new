/**
 * Enterprise Superuser Dashboard Layout
 * Consistent navigation, spacing, and grid alignment
 */

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/ui/Sidebar';
import { Navbar } from '../components/ui/Navbar';
import { useAuth } from '../context/AuthContext';
import { getSuperuserLinks } from '../lib/roleLinks';

interface SuperuserLayoutProps {
  children: React.ReactNode;
}

export function SuperuserLayout({ children }: SuperuserLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);
      if (desktop) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const links = getSuperuserLinks();

  const handleNavigate = (path: string) => {
    navigate(path);
    if (!isDesktop) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--brand-surface-secondary)]">
      {/* Sidebar */}
      <Sidebar
        links={links}
        activePath={location.pathname}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onCollapsedToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onNavigate={handleNavigate}
        isDesktop={isDesktop}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Navbar
          brandName="SaaS School Portal"
          brandSubtitle="Multi-tenant school experience"
          links={[]}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
          user={user}
          onLogout={logout}
        />

        {/* Page Content */}
        <main id="main-content" className="flex-1 overflow-y-auto page-content" role="main">
          <div className="mx-auto page-container">{children}</div>
        </main>
      </div>
    </div>
  );
}
