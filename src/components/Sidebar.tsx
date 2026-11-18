import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  DoorOpen,
  Megaphone,
  BookOpen,
  CalendarClock,
  CheckSquare,
  QrCode,
  LogOut,
  Sun,
  Moon,
  UserRound,
  Home,
  CalendarDays,
  MessageSquare,
  CheckCircle2,
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
  | 'qrpass'
  | 'profile';

interface SidebarProps {
  activeRole: UserRole;
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  activeSessionCount: number;
  coursesCount: number;
  announcementsCount: number;
  unreadAnnouncementsCount: number;
  centerActive?: boolean;
  onMobileCenterAction?: () => void;
}

interface NavItem {
  id: DashboardTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}

interface MobileNavSlot {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isCenter?: boolean;
  isActive: boolean;
  badge?: number;
  onClick: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeRole,
  activeTab,
  setActiveTab,
  activeSessionCount,
  coursesCount,
  announcementsCount,
  unreadAnnouncementsCount,
  centerActive,
  onMobileCenterAction,
}) => {
  const { user, userProfile, signOutUser } = useAuth();
  const { theme, setTheme } = useTheme();

  const navByRole: Record<UserRole, NavItem[]> = {
    admin: [
      { id: 'overview', label: 'Home', icon: Home },
      { id: 'rooms', label: 'Room monitor', icon: DoorOpen, count: coursesCount },
      { id: 'courses', label: 'Attendance', icon: CheckCircle2, count: activeSessionCount },
      { id: 'announcements', label: 'Announcements', icon: MessageSquare, count: announcementsCount },
      { id: 'profile', label: 'Profile', icon: UserRound },
    ],
    professor: [
      { id: 'schedule', label: 'Live attendance', icon: CalendarClock, count: activeSessionCount },
      { id: 'attendance', label: 'My classes', icon: CheckSquare, count: coursesCount },
      { id: 'announcements', label: 'Announcements', icon: Megaphone, count: announcementsCount },
      { id: 'profile', label: 'Profile', icon: UserRound },
    ],
    student: [
      { id: 'calendar', label: 'Home', icon: Home },
      { id: 'schedule', label: 'Schedule', icon: CalendarDays },
      { id: 'qrpass', label: 'Attendance', icon: CheckCircle2 },
      {
        id: 'announcements',
        label: 'Announcements',
        icon: MessageSquare,
        count: unreadAnnouncementsCount > 0 ? unreadAnnouncementsCount : announcementsCount,
      },
      { id: 'profile', label: 'Profile', icon: UserRound },
    ],
  };

  const navItems = navByRole[activeRole];

  const displayName = userProfile?.displayName || user?.email?.split('@')[0] || 'Attendly Member';
  const initials = React.useMemo(() => {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'AT';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [displayName]);

  const roleTitle =
    activeRole === 'admin'
      ? 'Administrator'
      : activeRole === 'professor'
      ? `${coursesCount} classes`
      : userProfile?.department || 'Student';

  const mobileSlots: MobileNavSlot[] =
    activeRole === 'student'
      ? [
          {
            key: 'home',
            label: 'Home',
            icon: Home,
            isActive: activeTab === 'calendar',
            onClick: () => setActiveTab('calendar'),
          },
          {
            key: 'schedule',
            label: 'Schedule',
            icon: CalendarDays,
            isActive: activeTab === 'schedule',
            onClick: () => setActiveTab('schedule'),
          },
          {
            key: 'myid',
            label: 'My ID',
            icon: QrCode,
            isCenter: true,
            isActive: activeTab === 'qrpass',
            onClick: () => setActiveTab('qrpass'),
          },
          {
            key: 'notices',
            label: 'Notices',
            icon: MessageSquare,
            isActive: activeTab === 'announcements',
            badge: unreadAnnouncementsCount > 0 ? unreadAnnouncementsCount : undefined,
            onClick: () => setActiveTab('announcements'),
          },
          {
            key: 'profile',
            label: 'Profile',
            icon: UserRound,
            isActive: activeTab === 'profile',
            onClick: () => setActiveTab('profile'),
          },
        ]
      : activeRole === 'professor'
      ? [
          {
            key: 'home',
            label: 'Home',
            icon: Home,
            isActive: activeTab === 'schedule',
            onClick: () => setActiveTab('schedule'),
          },
          {
            key: 'classes',
            label: 'Classes',
            icon: BookOpen,
            isActive: activeTab === 'attendance',
            onClick: () => setActiveTab('attendance'),
          },
          {
            key: 'scanqr',
            label: 'Scan QR',
            icon: QrCode,
            isCenter: true,
            isActive: Boolean(centerActive),
            onClick: () => onMobileCenterAction?.(),
          },
          {
            key: 'post',
            label: 'Notices',
            icon: Megaphone,
            isActive: activeTab === 'announcements',
            badge: announcementsCount > 0 ? announcementsCount : undefined,
            onClick: () => setActiveTab('announcements'),
          },
          {
            key: 'profile',
            label: 'Profile',
            icon: UserRound,
            isActive: activeTab === 'profile',
            onClick: () => setActiveTab('profile'),
          },
        ]
      : [
          {
            key: 'home',
            label: 'Home',
            icon: Home,
            isActive: activeTab === 'overview',
            onClick: () => setActiveTab('overview'),
          },
          {
            key: 'rooms',
            label: 'Rooms',
            icon: DoorOpen,
            isActive: activeTab === 'rooms',
            onClick: () => setActiveTab('rooms'),
          },
          {
            key: 'post',
            label: 'Post',
            icon: Megaphone,
            isCenter: true,
            isActive: activeTab === 'announcements',
            onClick: () => setActiveTab('announcements'),
          },
          {
            key: 'courses',
            label: 'Attendance',
            icon: CheckCircle2,
            isActive: activeTab === 'courses',
            onClick: () => setActiveTab('courses'),
          },
          {
            key: 'profile',
            label: 'Profile',
            icon: UserRound,
            isActive: activeTab === 'profile',
            onClick: () => setActiveTab('profile'),
          },
        ];

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Brand Header */}
        <div className="px-5 pt-5 pb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <AttendlyLogo size="sm" showGlow={false} />
            <div className="min-w-0">
              <div className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
                Attendly
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#A6A0CE] font-medium truncate">
                Know where to be and when.
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="px-3.5 py-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 min-h-[42px] rounded-xl text-[13px] transition cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#ECE9FC] dark:bg-[#2A2454] text-[#5346E8] dark:text-white font-bold shadow-2xs'
                    : 'text-slate-600 dark:text-[#A6A0CE] hover:bg-[#F5F3FE] dark:hover:bg-[#241F4A] hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive
                        ? 'text-[#5346E8] dark:text-[#9D93FF]'
                        : 'text-slate-400 dark:text-[#7E78B0]'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.count !== undefined && (
                  <span
                    className={`text-[11px] font-mono tabular-nums shrink-0 ${
                      item.id === 'announcements' &&
                      activeRole === 'student' &&
                      unreadAnnouncementsCount > 0
                        ? 'bg-rose-500 text-white px-1.5 py-0.5 rounded-full font-bold'
                        : isActive
                        ? 'text-[#5346E8] dark:text-[#B5ADFF] font-semibold'
                        : 'text-slate-400 dark:text-[#7E78B0]'
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

      {/* Bottom Controls: Appearance + User Card */}
      <div className="p-3.5 space-y-3 border-t border-[#EFEBFD] dark:border-[#2C2654]">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 dark:text-[#8E88BE] px-1 mb-1.5">
            Appearance
          </p>
          <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-[#F4F2FC] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61]">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`py-1.5 px-2.5 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                theme === 'light'
                  ? 'bg-[#171332] text-white shadow-xs'
                  : 'text-slate-600 dark:text-[#A6A0CE] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Light</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`py-1.5 px-2.5 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                theme === 'dark'
                  ? 'bg-white text-[#171332] shadow-xs'
                  : 'text-slate-600 dark:text-[#A6A0CE] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Dark</span>
            </button>
          </div>
        </div>

        {/* User Profile Card */}
        <div className="p-2.5 rounded-2xl bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#6B5BF7] to-[#5142E6] text-white font-bold flex items-center justify-center shrink-0 text-xs">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {displayName}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-[#A6A0CE] truncate">
                {roleTitle}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOutUser()}
            title="Sign Out"
            className="p-2 text-slate-400 dark:text-[#A6A0CE] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-[#342D69] rounded-xl transition shrink-0 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Floating Rounded Sidebar */}
      <div className="hidden xl:flex p-3.5 pr-0 shrink-0 h-full z-20 select-none smooth-resize">
        <aside className="w-64 bg-white dark:bg-[#1B1738] border border-[#E7E3FA] dark:border-[#2C2654] rounded-3xl flex flex-col h-full shadow-[0_14px_40px_-15px_rgba(81,66,230,0.12)] dark:shadow-[0_18px_40px_-15px_rgba(0,0,0,0.45)] overflow-y-auto subtle-scrollbar smooth-scroll">
          {sidebarContent}
        </aside>
      </div>

      {/* Mobile & Tablet Floating Bottom Pill Navigation Bar (zero-height order-last anchor + fixed viewport bottom, fully transparent around pill) */}
      <div className="xl:hidden order-last shrink-0 h-0 overflow-visible z-40 pointer-events-none select-none">
        <div className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] inset-x-0 z-40 px-3 sm:px-6 flex justify-center pointer-events-none bg-transparent smooth-resize">
          <nav
            aria-label="Mobile and tablet navigation"
            className={`pointer-events-auto w-full max-w-[460px] md:max-w-[600px] lg:max-w-[660px] bg-white/95 dark:bg-[#1B1738]/95 backdrop-blur-md border border-[#E7E3FA] dark:border-[#2C2654] rounded-[28px] px-2 md:px-4 py-1.5 md:py-2 shadow-[0_14px_40px_-10px_rgba(81,66,230,0.28)] dark:shadow-[0_18px_40px_-10px_rgba(0,0,0,0.65)] grid ${
              mobileSlots.length === 4 ? 'grid-cols-4 items-center' : 'grid-cols-5 items-end'
            } gap-1 md:gap-2 touch-manipulation smooth-resize`}
          >
            {mobileSlots.map((slot) => {
              const Icon = slot.icon;
              if (slot.isCenter) {
                return (
                  <button
                    key={slot.key}
                    type="button"
                    onClick={slot.onClick}
                    className="flex flex-col items-center justify-center -mt-6 cursor-pointer group"
                  >
                    <div
                      className={`w-[52px] h-[52px] md:w-14 md:h-14 rounded-full bg-gradient-to-br from-[#7B6CFF] via-[#6252F3] to-[#4A3CE0] text-white flex items-center justify-center shadow-[0_10px_24px_-4px_rgba(81,66,230,0.55)] ring-4 ring-[#ECE9FC] dark:ring-[#110E26] transition-transform duration-200 group-active:scale-95 ${
                        slot.isActive ? 'scale-105' : ''
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span
                      className={`mt-1 text-[10px] md:text-[11px] font-bold tracking-tight leading-none ${
                        slot.isActive
                          ? 'text-[#5346E8] dark:text-white'
                          : 'text-slate-600 dark:text-[#BDB6FF]'
                      }`}
                    >
                      {slot.label}
                    </span>
                  </button>
                );
              }

              return (
                <button
                  key={slot.key}
                  type="button"
                  onClick={slot.onClick}
                  className={`relative py-1.5 px-1 md:px-2 min-h-[48px] rounded-2xl flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
                    slot.isActive
                      ? 'text-[#5346E8] dark:text-white'
                      : 'text-slate-500 dark:text-[#8E88BE] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <div
                    className={`relative p-1.5 md:px-2.5 md:py-1.5 rounded-xl transition ${
                      slot.isActive ? 'bg-[#ECE9FC] dark:bg-[#2A2454]' : ''
                    }`}
                  >
                    <Icon className="w-4 h-4 md:w-[18px] md:h-[18px]" />
                    {slot.badge !== undefined && (
                      <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-mono font-bold flex items-center justify-center ring-2 ring-white dark:ring-[#1B1738]">
                        {slot.badge}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] md:text-[11px] leading-tight truncate max-w-full ${
                      slot.isActive ? 'font-bold' : 'font-medium'
                    }`}
                  >
                    {slot.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
};
