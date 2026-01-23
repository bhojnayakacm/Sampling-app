import { ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Package,
  BarChart3,
  Users,
  Menu,
  X,
  LogOut,
  LayoutDashboard
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: typeof Package;
  disabled?: boolean;
}

interface DashboardLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const navItems: NavItem[] = [
  {
    id: 'sample-requests',
    label: 'Dashboard',
    icon: Package,
  },
  {
    id: 'reports',
    label: 'Reports & Analytics',
    icon: BarChart3,
  },
  {
    id: 'clients',
    label: 'Users',
    icon: Users,
    disabled: true,
  },
];

export default function DashboardLayout({
  children,
  activeTab,
  onTabChange
}: DashboardLayoutProps) {
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Clean Light Sidebar - Full height with sticky footer */}
      <aside
        className={cn(
          "fixed lg:sticky lg:top-0 inset-y-0 left-0 z-50 w-72 h-screen bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0 shadow-xl" : "-translate-x-full"
        )}
      >
        {/* Logo/Header - Fixed at top */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center">
              <LayoutDashboard className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">SampleHub</h1>
              <p className="text-xs text-slate-500 capitalize">{profile?.role || 'coordinator'}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden text-slate-500 hover:bg-slate-100"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation Menu - Scrollable middle section */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-3">
            Navigation
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (!item.disabled) {
                    onTabChange(item.id);
                    setSidebarOpen(false);
                  }
                }}
                disabled={item.disabled}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive && "bg-indigo-50 text-indigo-700",
                  !isActive && !item.disabled && "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  item.disabled && "text-slate-400 cursor-not-allowed"
                )}
              >
                <Icon className={cn(
                  "h-5 w-5 flex-shrink-0",
                  isActive ? "text-indigo-600" : "text-slate-400"
                )} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.disabled && (
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Profile & Sign Out - Sticky at bottom */}
        <div className="p-4 border-t border-slate-100 shrink-0 mt-auto">
          <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-lg mb-3">
            <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center">
              <span className="text-sm font-bold text-indigo-600">
                {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {profile?.full_name || 'User'}
              </p>
              <p className="text-xs text-slate-500 capitalize">
                {profile?.role || 'coordinator'}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={signOut}
            className="w-full gap-2 min-h-[44px] border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
            className="text-slate-600 hover:bg-slate-100"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-indigo-600 flex items-center justify-center">
              <LayoutDashboard className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-base font-bold text-slate-900">SampleHub</h1>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  );
}
