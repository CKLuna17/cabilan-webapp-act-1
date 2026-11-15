import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  DoorOpen,
  Megaphone,
  BookOpen,
  CalendarClock,
  CheckSquare,
  CalendarDays,
  QrCode,
  LogOut,
  ShieldCheck,
  BookOpenCheck,
  GraduationCap,
  X,
} from 'lucide-react';
import { AttendlyLogo } from './AttendlyLogo';
import { UserRole } from '../types/attendly';

export type DashboardTab =
  | 'overview'
  | 'rooms'
  | 'announcements'
  | 'courses'
  | 'schedule'
  | 'attendance'
  | 'calendar'
  | 'qrpass';

interface SidebarProps {
  activeRole: UserRole;
  onSelectViewRole: (role: UserRole) => void;
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  activeSessionCount: number;
  coursesCount: number;
  announcementsCount: number;
  unreadAnnouncementsCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: DashboardTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeRole,
  onSelectViewRole,
  activeTab,
  setActiveTab,
  activeSessionCount,
  coursesCount,
  announcementsCount,
  unreadAnnouncementsCount,
  mobileOpen,
  onCloseMobile,
}) => {
  const { user, userProfile, signOutUser } = useAuth();

  const navByRole: Record<UserRole, NavItem[]> = {
    admin: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'rooms', label: 'Room Usage', icon: DoorOpen, count: coursesCount },
      { id: 'announcements', label: 'Official Announcements', icon: Megaphone, count: announcementsCount },
      { id: 'courses', label: 'Courses & Sessions', icon: BookOpen, count: activeSessionCount },
    ],
    professor: [
      { id: 'schedule', label: 'Schedule & QR Scan', icon: CalendarClock, count: activeSessionCount },
      { id: 'attendance', label: 'Subject Attendance', icon: CheckSquare, count: coursesCount },
      { id: 'announcements', label: 'Subject Announcements', icon: Megaphone, count: announcementsCount },
    ],
    student: [
      { id: 'calendar', label: 'Schedule Calendar', icon: CalendarDays, count: coursesCount },
      { id: 'qrpass', label: 'My Student QR', icon: QrCode },
      {
        id: 'announcements',
        label: 'Announcements',
        icon: Megaphone,
        count: unreadAnnouncementsCount > 0 ? unreadAnnouncementsCount : announcementsCount,
      },
    ],
  };

  const navItems = navByRole[activeRole];

  const roleSwitcherOptions: { id: UserRole; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'admin', label: 'Admin', icon: ShieldCheck },
    { id: 'professor', label: 'Professor', icon: BookOpenCheck },
    { id: 'student', label: 'Student', icon: GraduationCap },
  ];

  const roleTitle = activeRole === 'admin' ? 'Admin' : activeRole === 'professor' ? 'Professor' : 'Student';

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Brand Header with School Tracking Logo */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <AttendlyLogo size="sm" showGlow={false} />
            <div className="min-w-0">
              <div className="text-xl font-extrabold tracking-tight text-white truncate drop-shadow-2xs">
                Attendly
              </div>
              <p className="text-[11px] text-white/75 font-medium truncate">
                Know where to be and when.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="lg:hidden p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1.5">
          <div className="px-3 pb-2 text-[11px] font-semibold tracking-wide text-white/55">
            {roleTitle} Dashboard
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition cursor-pointer backdrop-blur-xs whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600/85 text-white shadow-lg shadow-blue-600/30 border border-white/25 font-semibold'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-white/70'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.count !== undefined && (
                  <span
                    className={`text-xs font-mono tabular-nums shrink-0 ${
                      item.id === 'announcements' && activeRole === 'student' && unreadAnnouncementsCount > 0
                        ? 'bg-rose-500 text-white px-1.5 py-0.5 rounded-full font-bold'
                        : 'text-white/75'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Portal View Switcher & User Info */}
      <div className="p-4 space-y-3 border-t border-white/10">
        <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15">
          <p className="text-[11px] font-semibold text-white/70 px-1 mb-2">
            Dashboard View
          </p>
          <div className="grid grid-cols-3 gap-1">
            {roleSwitcherOptions.map((opt) => {
              const Icon = opt.icon;
              const selected = activeRole === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onSelectViewRole(opt.id);
                    onCloseMobile();
                  }}
                  className={`py-2 px-1 min-h-[42px] rounded-lg text-[11px] font-semibold flex flex-col items-center justify-center gap-0.5 transition cursor-pointer whitespace-nowrap ${
                    selected
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* User Profile Bar */}
        <div className="pt-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 text-white font-semibold flex items-center justify-center shrink-0 text-xs uppercase border border-white/30">
              {(userProfile?.displayName || user?.email || 'U')[0]}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {userProfile?.displayName || 'Attendly Member'}
              </p>
              <p className="text-[11px] text-white/70 truncate">
                {roleTitle} · {userProfile?.department || 'Campus'}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOutUser()}
            title="Sign Out"
            className="p-2.5 text-white/70 hover:text-rose-300 hover:bg-white/10 rounded-xl transition shrink-0 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:flex w-64 bg-slate-950/55 backdrop-blur-3xl text-slate-200 flex-col shrink-0 h-screen sticky top-0 border-r border-white/15 z-20 select-none shadow-2xl">
        {sidebarContent}
      </aside>

      {/* Mobile & Tablet Slide-Over Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] bg-slate-950/80 backdrop-blur-3xl text-slate-200 flex flex-col h-[100dvh] border-r border-white/20 z-10 select-none shadow-2xl overflow-y-auto">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
