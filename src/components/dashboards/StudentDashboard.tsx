import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  MapPin,
  CheckCircle2,
  CalendarDays,
  Megaphone,
  QrCode,
  Sparkles,
  ArrowLeft,
  Search,
  Sun,
  Moon,
  Download,
  Barcode,
  ThumbsUp,
  Check,
  LogOut,
  ChevronRight,
  Maximize2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  CourseRecord,
  ClassSessionRecord,
  AttendanceRecord,
  AnnouncementRecord,
  AnnouncementPhotoRecord,
  AnnouncementReactionRecord,
  AnnouncementCategory,
  StudentQRPayload,
} from '../../types/attendly';
import { DashboardTab } from '../Sidebar';
import { AttendlyLogo } from '../AttendlyLogo';
import { AnnouncementPhotoGallery } from '../AnnouncementPhotoGallery';
import { deriveStudentCode, seedCampusData } from '../../lib/attendlySeed';

interface StudentDashboardProps {
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  courses: CourseRecord[];
  sessions: ClassSessionRecord[];
  attendance: AttendanceRecord[];
  announcements: AnnouncementRecord[];
  announcementPhotos: AnnouncementPhotoRecord[];
  reactions: AnnouncementReactionRecord[];
  readAnnouncementIds: string[];
  onMarkSubjectRead: (courseId: string) => void;
  onMarkAnnouncementRead: (announcementId: string) => void;
  onToggleReaction: (ann: AnnouncementRecord, type: 'gotIt' | 'thanks') => Promise<void>;
  onNotify: (msg: string) => void;
}

const WEEK_DAYS = [
  { short: 'Mon', label: 'Monday', offset: 0 },
  { short: 'Tue', label: 'Tuesday', offset: 1 },
  { short: 'Wed', label: 'Wednesday', offset: 2 },
  { short: 'Thu', label: 'Thursday', offset: 3 },
  { short: 'Fri', label: 'Friday', offset: 4 },
];

const COURSE_CARD_PALETTES = [
  'bg-[#ECE9FC] dark:bg-[#272152] border-[#DCD6FA] dark:border-[#393074] text-[#4C3EE0] dark:text-[#BDB6FF]',
  'bg-[#E6F1FD] dark:bg-[#192A4A] border-[#CEE3FB] dark:border-[#294370] text-[#1D5DB0] dark:text-[#8EC2FF]',
  'bg-[#FCE7F3] dark:bg-[#3A1E36] border-[#F9CEE6] dark:border-[#5E2F57] text-[#B8286E] dark:text-[#F59BCB]',
  'bg-[#E6F7EE] dark:bg-[#14382A] border-[#C9EEDB] dark:border-[#215741] text-[#15803D] dark:text-[#7CE4AF]',
  'bg-[#FEF3C7] dark:bg-[#3B2C16] border-[#FDE49B] dark:border-[#5C4420] text-[#B45309] dark:text-[#F9C971]',
];

const BAR_COLORS = [
  'bg-[#5B4CEB] dark:bg-[#B2AAFF]',
  'bg-[#2563EB] dark:bg-[#7DB8FF]',
  'bg-[#DB2777] dark:bg-[#F78CC2]',
  'bg-[#16A34A] dark:bg-[#7CE4AF]',
  'bg-[#D97706] dark:bg-[#F5C065]',
];

function getWeekDates(): { short: string; label: string; dateNum: number }[] {
  const now = new Date();
  const day = now.getDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  return WEEK_DAYS.map((wd) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + wd.offset);
    return {
      short: wd.short,
      label: wd.label,
      dateNum: d.getDate(),
    };
  });
}

function getMonthGrid() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayDate = now.getDate();
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const shortMonth = now.toLocaleDateString('en-US', { month: 'long' });
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun..6=Sat
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { day: number | null; isWeekend: boolean; isToday: boolean }[] = [];

  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push({ day: null, isWeekend: i === 0 || i === 6, isToday: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month, d).getDay();
    cells.push({
      day: d,
      isWeekend: dow === 0 || dow === 6,
      isToday: d === todayDate,
    });
  }
  return { monthLabel, shortMonth, cells };
}

function categoryMeta(cat?: AnnouncementCategory, scope?: 'official' | 'subject') {
  const resolved = cat || (scope === 'official' ? 'official' : 'info');
  switch (resolved) {
    case 'room_change':
      return {
        label: 'Room change',
        cls: 'bg-[#E6F1FD] dark:bg-[#1C3258] text-[#1D5DB0] dark:text-[#8EC2FF]',
      };
    case 'quiz':
      return {
        label: 'Quiz',
        cls: 'bg-[#FEF3C7] dark:bg-[#3E2E16] text-[#B45309] dark:text-[#F8C871]',
      };
    case 'no_class':
      return {
        label: 'No class',
        cls: 'bg-[#FCE7F3] dark:bg-[#3E1F38] text-[#BE185D] dark:text-[#F79AC8]',
      };
    case 'official':
      return {
        label: 'School',
        cls: 'bg-[#ECE9FC] dark:bg-[#2B2459] text-[#5346E8] dark:text-[#BDB6FF]',
      };
    default:
      return {
        label: 'Info',
        cls: 'bg-[#E6F7EE] dark:bg-[#153B2C] text-[#15803D] dark:text-[#7CE4AF]',
      };
  }
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  activeTab,
  setActiveTab,
  courses,
  attendance,
  announcements,
  announcementPhotos,
  reactions,
  readAnnouncementIds,
  onMarkSubjectRead,
  onMarkAnnouncementRead,
  onToggleReaction,
  onNotify,
}) => {
  const { user, userProfile, signOutUser } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [seeding, setSeeding] = useState(false);
  const [portraitLoadFailed, setPortraitLoadFailed] = useState(false);
  const [idMode, setIdMode] = useState<'qr' | 'barcode'>('qr');
  const [fullScreenIdOpen, setFullScreenIdOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [noticeCategoryFilter, setNoticeCategoryFilter] = useState<
    'all' | 'class_changes' | 'quizzes' | 'school'
  >('all');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');

  const weekDates = useMemo(() => getWeekDates(), []);
  const monthGrid = useMemo(() => getMonthGrid(), []);
  const todayShortRaw = new Date().toLocaleDateString('en-US', { weekday: 'short' });
  const defaultDayShort = WEEK_DAYS.some((d) => d.short === todayShortRaw) ? todayShortRaw : 'Mon';

  const studentId = user?.uid || 'student';
  const studentName = userProfile?.displayName || user?.email?.split('@')[0] || 'Student';
  const firstName = studentName.split(' ')[0] || studentName;
  const studentCode = userProfile?.studentCode || deriveStudentCode(studentId);
  const department = userProfile?.department || 'BSIT · Computer Science';
  const portraitSrc = !portraitLoadFailed
    ? userProfile?.photoDataUrl || user?.photoURL || ''
    : '';

  const studentInitials = useMemo(() => {
    const parts = studentName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'ST';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [studentName]);

  useEffect(() => {
    setPortraitLoadFailed(false);
  }, [userProfile?.photoDataUrl, user?.photoURL]);

  const qrPayload: StudentQRPayload = useMemo(
    () => ({
      app: 'attendly',
      studentId,
      studentName,
      studentCode,
      department,
    }),
    [studentId, studentName, studentCode, department]
  );

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(JSON.stringify(qrPayload), {
      width: 280,
      margin: 2,
      color: {
        dark: '#141033',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [qrPayload]);

  // Deterministic barcode stripe widths from studentCode
  const barcodeBars = useMemo(() => {
    const seedStr = `${studentCode}-${studentId.slice(0, 8)}`;
    const bars: number[] = [];
    for (let i = 0; i < 42; i++) {
      const code = seedStr.charCodeAt(i % seedStr.length);
      bars.push((code + i * 7) % 3 === 0 ? 3 : (code + i) % 2 === 0 ? 2 : 1);
    }
    return bars;
  }, [studentCode, studentId]);

  const myAttendance = useMemo(
    () => attendance.filter((a) => a.studentId === studentId),
    [attendance, studentId]
  );

  const attendedCourseIds = useMemo(() => {
    const set = new Set<string>();
    for (const rec of myAttendance) {
      if (rec.status === 'present' || rec.status === 'late') {
        set.add(rec.courseId);
      }
    }
    return set;
  }, [myAttendance]);

  const latestScan = useMemo(() => {
    if (myAttendance.length === 0) return null;
    return [...myAttendance].sort((a, b) =>
      (b.checkedInAt || '').localeCompare(a.checkedInAt || '')
    )[0];
  }, [myAttendance]);

  const photosByAnnouncementId = useMemo(() => {
    const map = new Map<string, AnnouncementPhotoRecord[]>();
    for (const photo of announcementPhotos) {
      const existing = map.get(photo.announcementId) || [];
      existing.push(photo);
      map.set(photo.announcementId, existing);
    }
    return map;
  }, [announcementPhotos]);

  const reactionStatsByAnn = useMemo(() => {
    const map = new Map<
      string,
      { gotIt: number; thanks: number; myGotIt: boolean; myThanks: boolean }
    >();
    for (const r of reactions) {
      const entry = map.get(r.announcementId) || {
        gotIt: 0,
        thanks: 0,
        myGotIt: false,
        myThanks: false,
      };
      if (r.gotIt) {
        entry.gotIt += 1;
        if (r.userId === studentId) entry.myGotIt = true;
      }
      if (r.thanks) {
        entry.thanks += 1;
        if (r.userId === studentId) entry.myThanks = true;
      }
      map.set(r.announcementId, entry);
    }
    return map;
  }, [reactions, studentId]);

  const subjectAnnouncements = useMemo(
    () => announcements.filter((a) => a.scope === 'subject'),
    [announcements]
  );

  const unreadCountByCourse = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ann of subjectAnnouncements) {
      if (!readAnnouncementIds.includes(ann.id)) {
        counts.set(ann.courseId, (counts.get(ann.courseId) || 0) + 1);
      }
    }
    return counts;
  }, [subjectAnnouncements, readAnnouncementIds]);

  const totalUnreadNotices = useMemo(
    () => announcements.filter((a) => !readAnnouncementIds.includes(a.id)).length,
    [announcements, readAnnouncementIds]
  );

  const todayCourses = useMemo(
    () =>
      courses.filter((c) =>
        (c.scheduleDays || 'Mon · Wed · Fri')
          .toLowerCase()
          .includes(defaultDayShort.toLowerCase())
      ),
    [courses, defaultDayShort]
  );

  const attendanceRatePct = useMemo(() => {
    if (courses.length === 0) return 100;
    return Math.round((attendedCourseIds.size / courses.length) * 100);
  }, [courses.length, attendedCourseIds.size]);

  const nextUpcomingCourse = useMemo(
    () => todayCourses.find((c) => !attendedCourseIds.has(c.id)) || todayCourses[0] || null,
    [todayCourses, attendedCourseIds]
  );

  const filteredAnnouncements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return announcements.filter((ann) => {
      if (selectedSubjectFilter !== 'all' && ann.courseId !== selectedSubjectFilter) {
        return false;
      }
      if (noticeCategoryFilter === 'class_changes') {
        const c = ann.category || (ann.scope === 'official' ? 'official' : 'info');
        if (c !== 'room_change' && c !== 'no_class') return false;
      } else if (noticeCategoryFilter === 'quizzes') {
        if (ann.category !== 'quiz') return false;
      } else if (noticeCategoryFilter === 'school') {
        if (ann.scope !== 'official') return false;
      }
      if (!q) return true;
      return (
        ann.title.toLowerCase().includes(q) ||
        ann.message.toLowerCase().includes(q) ||
        ann.courseCode.toLowerCase().includes(q) ||
        ann.authorName.toLowerCase().includes(q)
      );
    });
  }, [announcements, noticeCategoryFilter, selectedSubjectFilter, searchQuery]);

  const handleSeed = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      await seedCampusData(user.uid, studentName);
      onNotify('Student schedule calendar and campus notices loaded');
    } finally {
      setSeeding(false);
    }
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `Attendly-${studentCode}.png`;
    link.click();
    onNotify('Student QR pass downloaded');
  };

  const handleInspectSubjectAnnouncements = (courseId: string) => {
    setSelectedSubjectFilter(courseId);
    setNoticeCategoryFilter('all');
    onMarkSubjectRead(courseId);
    setActiveTab('announcements');
  };

  const todayDisplay = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const greetingText = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const renderIdStyleQrCard = () => (
    <section
      aria-label="Student ID Attendance Pass"
      className="rounded-[28px] overflow-hidden border border-[#5B4CEB]/45 dark:border-[#8D81FF]/45 shadow-[0_22px_54px_-14px_rgba(76,60,217,0.42)] dark:shadow-[0_24px_60px_-14px_rgba(86,70,236,0.48)] grid grid-cols-1 md:grid-cols-[1.58fr_1fr] bg-white"
    >
      {/* Left Deep Indigo / Violet Student ID Panel */}
      <div className="bg-gradient-to-br from-[#5240E8] via-[#412FC9] to-[#2F209E] dark:from-[#5E4EF2] dark:via-[#4A38D6] dark:to-[#3223A6] p-5 sm:p-6 text-white flex flex-col justify-between gap-4 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-14 w-48 h-48 rounded-full bg-white/10 blur-2xl"
        />

        {/* Top Badge */}
        <div className="flex items-center justify-between gap-2 relative z-10">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/18 text-[10px] font-extrabold tracking-[0.14em] uppercase text-white">
            STUDENT ID
          </span>
        </div>

        {/* Portrait + Student Information */}
        <div className="flex flex-col min-[360px]:flex-row items-center gap-3.5 sm:gap-5 text-center min-[360px]:text-left relative z-10">
          <div className="w-20 h-24 sm:w-28 sm:h-32 rounded-2xl overflow-hidden bg-[#C7BEFF] border border-white/25 shrink-0 flex items-center justify-center shadow-inner relative">
            {portraitSrc ? (
              <img
                src={portraitSrc}
                alt={`${studentName} ID Portrait`}
                referrerPolicy="no-referrer"
                onError={() => setPortraitLoadFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <svg
                viewBox="0 0 80 96"
                className="w-full h-full"
                aria-hidden="true"
              >
                <circle cx="40" cy="34" r="16" fill="#FFFFFF" />
                <path
                  d="M12 96 C12 72, 24 58, 40 58 C56 58, 68 72, 68 96 Z"
                  fill="#FFFFFF"
                />
              </svg>
            )}
          </div>

          <div className="flex-1 min-w-0 w-full space-y-1">
            <h3 className="text-lg sm:text-2xl font-extrabold tracking-tight text-white truncate">
              {studentName}
            </h3>
            <p className="text-sm sm:text-base font-bold font-mono tabular-nums text-white/95 truncate">
              {studentCode}
            </p>
            <p className="text-xs sm:text-sm font-medium text-white/85 truncate">
              {department}
            </p>
            <p className="text-xs font-medium text-white/75 truncate">
              {user?.email || 'student@attendly.edu'}
            </p>
          </div>
        </div>

        {/* Centered White Barcode Strip in Student ID Box */}
        <div className="relative z-10 py-1.5 flex items-center justify-center">
          <div className="flex items-stretch justify-center gap-[2.5px] h-9 sm:h-11 overflow-hidden opacity-95">
            {barcodeBars.map((w, i) => (
              <div
                key={i}
                className="bg-white rounded-[1px] shrink-0"
                style={{ width: `${w * 1.8}px` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right Crisp White QR Panel */}
      <div className="bg-white text-slate-900 p-5 sm:p-6 flex flex-col items-center justify-center gap-3.5">
        <div className="p-2.5 rounded-2xl bg-white border border-[#E7E3FA] shadow-2xs">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR Code for ${studentName}`}
              className="w-36 h-36 sm:w-40 sm:h-40 rounded-lg"
            />
          ) : (
            <div className="w-36 h-36 sm:w-40 sm:h-40 flex items-center justify-center text-xs text-slate-400">
              Generating QR...
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5 w-full">
          <button
            type="button"
            onClick={handleDownloadQR}
            className="px-4 py-2 min-h-[38px] rounded-full text-xs font-bold text-white bg-[#5346E8] hover:bg-[#4336D6] shadow-md shadow-[#5346E8]/25 inline-flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
          <button
            type="button"
            onClick={() => setFullScreenIdOpen(true)}
            className="px-4 py-2 min-h-[38px] rounded-full text-xs font-bold text-slate-800 bg-[#F4F2FC] hover:bg-[#EAE6FA] border border-[#E7E3FA] inline-flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Full screen</span>
          </button>
        </div>
      </div>
    </section>
  );

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 xl:h-full overflow-y-auto subtle-scrollbar smooth-scroll smooth-resize">
      {/* Unified Top Greeting Header (Desktop + Tablet + Mobile) */}
      <header className="px-4 xl:px-7 pt-[max(1.35rem,env(safe-area-inset-top))] sm:pt-6 xl:pt-6 pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 smooth-resize">
        <div className="hidden xl:block min-w-0">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
            {greetingText}, {firstName}
          </h1>
          <p className="text-xs text-slate-500 dark:text-[#A6A0CE] font-medium mt-0.5">
            {todayDisplay} · 1st semester
          </p>
        </div>

        <div className="flex xl:hidden items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              aria-label="Open profile"
              className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6B5BF7] to-[#5142E6] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-md shadow-[#5142E6]/25 cursor-pointer"
            >
              {studentInitials}
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-500 dark:text-[#A6A0CE] truncate">
                {todayDisplay} · 1st semester
              </p>
              <h1 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                {greetingText}, {firstName}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="sm:hidden w-10 h-10 rounded-full bg-white dark:bg-[#1B1738] border border-[#E7E3FA] dark:border-[#2C2654] flex items-center justify-center text-slate-700 dark:text-white cursor-pointer shadow-2xs shrink-0"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {courses.length === 0 && (
            <button
              type="button"
              onClick={handleSeed}
              disabled={seeding}
              className="hidden sm:flex px-3.5 py-2.5 min-h-[42px] text-xs font-semibold text-[#5346E8] dark:text-[#BDB6FF] bg-white dark:bg-[#1B1738] border border-[#E7E3FA] dark:border-[#2C2654] rounded-full transition items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{seeding ? 'Loading...' : 'Load Sample Schedule'}</span>
            </button>
          )}
          <div className="relative flex-1 sm:flex-none sm:w-60">
            <Search className="w-4 h-4 text-slate-400 dark:text-[#8E88BE] absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search subjects or notices"
              className="w-full pl-10 pr-4 py-2.5 min-h-[42px] text-xs bg-white dark:bg-[#1B1738] border border-[#E7E3FA] dark:border-[#2C2654] rounded-full focus:outline-none focus:ring-2 focus:ring-[#6B5BF7]/30 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#8E88BE]"
            />
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="hidden sm:flex xl:hidden w-10 h-10 rounded-full bg-white dark:bg-[#1B1738] border border-[#E7E3FA] dark:border-[#2C2654] items-center justify-center text-slate-700 dark:text-white cursor-pointer shadow-2xs shrink-0 hover:border-[#6B5BF7] transition"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="px-4 xl:px-7 pt-3 xl:pt-4 pb-28 xl:pb-8 max-w-[1400px] w-full mx-auto space-y-5 flex-1 smooth-resize">
        {/* ================= CALENDAR / HOME OVERVIEW ================= */}
        {activeTab === 'calendar' && (
          <>
            {/* Empty State CTA on mobile if no courses */}
            {courses.length === 0 && (
              <div className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-6 text-center space-y-3 shadow-xs">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Your schedule calendar is currently empty
                </p>
                <p className="text-xs text-slate-500 dark:text-[#A6A0CE]">
                  Load the sample campus classes to test QR check-ins, calendar checkmarks, and subject notices.
                </p>
                <button
                  type="button"
                  onClick={handleSeed}
                  disabled={seeding}
                  className="px-5 py-2.5 min-h-[42px] text-xs font-bold text-white bg-gradient-to-r from-[#6B5BF7] to-[#5142E6] rounded-full shadow-md shadow-[#5142E6]/25 cursor-pointer"
                >
                  {seeding ? 'Loading...' : 'Load Sample Student Schedule'}
                </button>
              </div>
            )}

            {/* UNIFIED BENTO HOME LAYOUT (Synced Across Mobile, Tablet, and Desktop) */}
            <div className="space-y-5 smooth-resize">
              {/* 4 KPI Strip */}
              <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 smooth-resize">
                <div className="bg-white dark:bg-[#1B1738] rounded-2xl border border-[#E7E3FA] dark:border-[#2C2654] p-4 flex items-center gap-3.5 shadow-2xs">
                  <div className="w-11 h-11 rounded-2xl bg-[#E6F7EE] dark:bg-[#143D2B] text-[#15803D] dark:text-[#7CE4AF] flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-[#A6A0CE] truncate">
                      Attendance rate
                    </p>
                    <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                      {attendanceRatePct}%
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-[#8E88BE] truncate">
                      Across {courses.length} subjects
                    </p>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#1B1738] rounded-2xl border border-[#E7E3FA] dark:border-[#2C2654] p-4 flex items-center gap-3.5 shadow-2xs">
                  <div className="w-11 h-11 rounded-2xl bg-[#ECE9FC] dark:bg-[#272152] text-[#5346E8] dark:text-[#BDB6FF] flex items-center justify-center shrink-0">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-[#A6A0CE] truncate">
                      Classes today
                    </p>
                    <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                      {todayCourses.length}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-[#8E88BE] truncate">
                      {nextUpcomingCourse
                        ? `Next: ${nextUpcomingCourse.startTime} · ${nextUpcomingCourse.room}`
                        : 'No remaining classes'}
                    </p>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#1B1738] rounded-2xl border border-[#E7E3FA] dark:border-[#2C2654] p-4 flex items-center gap-3.5 shadow-2xs">
                  <div className="w-11 h-11 rounded-2xl bg-[#E6F1FD] dark:bg-[#192A4A] text-[#1D5DB0] dark:text-[#8EC2FF] flex items-center justify-center shrink-0">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-[#A6A0CE] truncate">
                      Checked in
                    </p>
                    <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                      {attendedCourseIds.size} of {courses.length}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-[#8E88BE] truncate">
                      Scanned at the room
                    </p>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#1B1738] rounded-2xl border border-[#E7E3FA] dark:border-[#2C2654] p-4 flex items-center gap-3.5 shadow-2xs">
                  <div className="w-11 h-11 rounded-2xl bg-[#FCE7F3] dark:bg-[#3A1E36] text-[#B8286E] dark:text-[#F59BCB] flex items-center justify-center shrink-0">
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-[#A6A0CE] truncate">
                      New notices
                    </p>
                    <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                      {totalUnreadNotices}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-[#8E88BE] truncate">
                      From professors & admin
                    </p>
                  </div>
                </div>
              </div>

              {/* 2-Column Bento Main Area */}
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5 items-start smooth-resize">
                {/* Left: ID-Style QR Card + This week calendar */}
                <div className="space-y-5 min-w-0">
                  {/* Noticeable ID-Style QR Pass */}
                  {renderIdStyleQrCard()}

                  {/* This week Schedule Calendar */}
                  <section className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-5 space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                          This week
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-[#A6A0CE]">
                          {monthGrid.shortMonth}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E6F7EE] dark:bg-[#143D2B] text-[#15803D] dark:text-[#7CE4AF] text-xs font-bold">
                        <Check className="w-3.5 h-3.5" />
                        Checked in
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                      {weekDates.map((wd) => {
                        const isToday = wd.short === defaultDayShort;
                        const q = searchQuery.trim().toLowerCase();
                        const dayCourses = courses.filter((c) => {
                          const matchesDay = (c.scheduleDays || 'Mon · Wed · Fri')
                            .toLowerCase()
                            .includes(wd.short.toLowerCase());
                          if (!matchesDay) return false;
                          if (!q) return true;
                          return (
                            c.title.toLowerCase().includes(q) ||
                            c.code.toLowerCase().includes(q) ||
                            c.room.toLowerCase().includes(q)
                          );
                        });

                        return (
                          <div key={wd.short} className="space-y-2.5 min-w-0">
                            <div
                              className={`py-2 px-3 rounded-xl text-center font-bold text-xs ${
                                isToday
                                  ? 'bg-gradient-to-r from-[#6B5BF7] to-[#5142E6] text-white shadow-sm'
                                  : 'bg-[#F5F3FE] dark:bg-[#241F4A] text-slate-700 dark:text-[#D1CCEE]'
                              }`}
                            >
                              {wd.short}{' '}
                              <span className="font-mono tabular-nums">{wd.dateNum}</span>
                            </div>

                            <div className="space-y-2">
                              {dayCourses.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-[#E7E3FA] dark:border-[#2C2654] py-6 text-center text-[11px] text-slate-400 dark:text-[#7A74A6]">
                                  No classes
                                </div>
                              ) : (
                                dayCourses.map((course, idx) => {
                                  const palette =
                                    COURSE_CARD_PALETTES[idx % COURSE_CARD_PALETTES.length];
                                  const isScanned = attendedCourseIds.has(course.id);
                                  const unread = unreadCountByCourse.get(course.id) || 0;
                                  return (
                                    <div
                                      key={`${wd.short}-${course.id}`}
                                      className={`rounded-2xl border p-3 space-y-1 transition relative ${palette}`}
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="text-[10px] font-mono tabular-nums font-bold opacity-85">
                                          {course.startTime}
                                        </span>
                                        <div className="flex items-center gap-1">
                                          {unread > 0 && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleInspectSubjectAnnouncements(course.id)
                                              }
                                              title={`${unread} unread notice(s)`}
                                              className="min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold flex items-center justify-center cursor-pointer hover:bg-rose-600"
                                            >
                                              {unread}
                                            </button>
                                          )}
                                          {isScanned && (
                                            <Check
                                              className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0"
                                              aria-label="QR Scanned"
                                            />
                                          )}
                                        </div>
                                      </div>
                                      <p className="text-xs font-extrabold leading-snug line-clamp-2">
                                        {course.title}
                                      </p>
                                      <p className="text-[11px] opacity-80 truncate">
                                        {course.room}
                                      </p>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>

                {/* Right Rail: Mini Monthly Calendar + Announcements */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-5 items-start">
                  {/* Mini Monthly Calendar Card */}
                  <section className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-5 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        Calendar
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab('schedule')}
                        className="text-xs font-bold text-[#5346E8] dark:text-[#A399FF] hover:underline cursor-pointer"
                      >
                        Open schedule
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-0.5">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {monthGrid.monthLabel}
                      </span>
                      <div className="flex items-center gap-2.5 text-slate-500 dark:text-[#A6A0CE]">
                        <span className="inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#5346E8]" />
                          Class
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          None
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center pt-1">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                        <span
                          key={i}
                          className={`text-[10px] font-bold py-1 ${
                            i === 0 || i === 6
                              ? 'text-rose-400 dark:text-rose-300'
                              : 'text-slate-400 dark:text-[#8E88BE]'
                          }`}
                        >
                          {d}
                        </span>
                      ))}
                      {monthGrid.cells.map((cell, idx) =>
                        cell.day === null ? (
                          <div key={`empty-${idx}`} className="h-7" />
                        ) : (
                          <button
                            key={cell.day}
                            type="button"
                            onClick={() => setActiveTab('schedule')}
                            className={`h-7 rounded-lg text-[11px] font-mono tabular-nums flex items-center justify-center transition cursor-pointer ${
                              cell.isToday
                                ? 'bg-[#5346E8] text-white font-extrabold shadow-xs'
                                : cell.isWeekend
                                ? 'text-rose-500 dark:text-rose-300 hover:bg-[#F5F3FE] dark:hover:bg-[#241F4A]'
                                : 'bg-[#F4F2FC] dark:bg-[#241F4A] text-slate-800 dark:text-[#D1CCEE] font-semibold hover:bg-[#ECE9FC] dark:hover:bg-[#2E285D]'
                            }`}
                          >
                            {cell.day}
                          </button>
                        )
                      )}
                    </div>
                  </section>

                  {/* Announcements Preview Card */}
                  <section className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-5 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        Announcements
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab('announcements')}
                        className="text-xs font-bold text-[#5346E8] dark:text-[#A399FF] hover:underline cursor-pointer"
                      >
                        View all
                      </button>
                    </div>

                    {announcements.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-[#A6A0CE] py-4 text-center">
                        No notices posted yet.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {announcements.slice(0, 3).map((ann) => {
                          const cat = categoryMeta(ann.category, ann.scope);
                          const stats = reactionStatsByAnn.get(ann.id) || {
                            gotIt: 0,
                            thanks: 0,
                            myGotIt: false,
                            myThanks: false,
                          };
                          const authorParts = ann.authorName.trim().split(/\s+/).filter(Boolean);
                          const authorInitials =
                            authorParts.length >= 2
                              ? `${authorParts[0][0]}${authorParts[authorParts.length - 1][0]}`.toUpperCase()
                              : ann.authorName.slice(0, 2).toUpperCase();
                          return (
                            <div
                              key={ann.id}
                              className="p-3 rounded-2xl bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#EFEBFD] dark:border-[#322B61] space-y-2.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <div className="w-8 h-8 rounded-full bg-[#ECE9FC] dark:bg-[#312A61] text-[#5346E8] dark:text-[#BDB6FF] text-[11px] font-extrabold flex items-center justify-center shrink-0">
                                    {authorInitials}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-extrabold text-slate-900 dark:text-white leading-snug line-clamp-2">
                                      {ann.title}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-[#A6A0CE] truncate mt-0.5">
                                      {ann.authorName} ·{' '}
                                      {ann.activityDate ||
                                        new Date(ann.createdAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${cat.cls}`}
                                >
                                  {cat.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => void onToggleReaction(ann, 'gotIt')}
                                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 transition cursor-pointer ${
                                    stats.myGotIt
                                      ? 'bg-[#5346E8] text-white'
                                      : 'bg-white dark:bg-[#1B1738] text-slate-700 dark:text-[#D1CCEE] border border-[#E7E3FA] dark:border-[#322B61]'
                                  }`}
                                >
                                  <Check className="w-3 h-3" />
                                  Got it {stats.gotIt > 0 ? stats.gotIt : ''}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void onToggleReaction(ann, 'thanks')}
                                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 transition cursor-pointer ${
                                    stats.myThanks
                                      ? 'bg-[#5346E8] text-white'
                                      : 'bg-white dark:bg-[#1B1738] text-slate-700 dark:text-[#D1CCEE] border border-[#E7E3FA] dark:border-[#322B61]'
                                  }`}
                                >
                                  <ThumbsUp className="w-3 h-3" />
                                  Thanks {stats.thanks > 0 ? stats.thanks : ''}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ================= DEDICATED SCHEDULE TAB ================= */}
        {activeTab === 'schedule' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Weekly Schedule & Attendance
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#A6A0CE]">
                  Checkmarks appear automatically once your QR is scanned in class
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('qrpass')}
                className="px-4 py-2 rounded-full text-xs font-bold text-white bg-gradient-to-r from-[#6B5BF7] to-[#5142E6] cursor-pointer whitespace-nowrap"
              >
                Open Attendance Pass
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5 items-start smooth-resize">
              <div className="space-y-5 min-w-0">
                {/* 5-day Weekly Grid (Responsive across Mobile, Tablet, and Desktop) */}
                <section className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-5 space-y-4 shadow-2xs smooth-resize">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 smooth-resize">
                    {weekDates.map((wd) => {
                      const isToday = wd.short === defaultDayShort;
                      const dayCourses = courses.filter((c) =>
                        (c.scheduleDays || 'Mon · Wed · Fri')
                          .toLowerCase()
                          .includes(wd.short.toLowerCase())
                      );
                      return (
                        <div key={wd.short} className="space-y-2.5 min-w-0">
                          <div
                            className={`py-2 px-3 rounded-xl text-center font-bold text-xs ${
                              isToday
                                ? 'bg-gradient-to-r from-[#6B5BF7] to-[#5142E6] text-white shadow-sm'
                                : 'bg-[#F5F3FE] dark:bg-[#241F4A] text-slate-700 dark:text-[#D1CCEE]'
                            }`}
                          >
                            {wd.short} <span className="font-mono tabular-nums">{wd.dateNum}</span>
                          </div>
                          <div className="space-y-2">
                            {dayCourses.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-[#E7E3FA] dark:border-[#2C2654] py-6 text-center text-[11px] text-slate-400 dark:text-[#7A74A6]">
                                No classes
                              </div>
                            ) : (
                              dayCourses.map((course, idx) => {
                                const palette =
                                  COURSE_CARD_PALETTES[idx % COURSE_CARD_PALETTES.length];
                                const isScanned = attendedCourseIds.has(course.id);
                                return (
                                  <div
                                    key={`sched-${wd.short}-${course.id}`}
                                    className={`rounded-2xl border p-3 space-y-1 ${palette}`}
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="text-[10px] font-mono tabular-nums font-bold opacity-85">
                                        {course.startTime}
                                      </span>
                                      {isScanned && (
                                        <Check
                                          className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0"
                                          aria-label="QR Scanned"
                                        />
                                      )}
                                    </div>
                                    <p className="text-xs font-extrabold leading-snug line-clamp-2">
                                      {course.title}
                                    </p>
                                    <p className="text-[11px] opacity-80 truncate">{course.room}</p>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Attendance by subject */}
                <section className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-5 space-y-4 shadow-2xs">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Attendance by subject
                  </h3>
                  <div className="space-y-3.5">
                    {courses.map((course, idx) => {
                      const scanned = attendedCourseIds.has(course.id);
                      const pct = scanned ? 100 : 0;
                      const barCls = BAR_COLORS[idx % BAR_COLORS.length];
                      return (
                        <div
                          key={course.id}
                          className="grid grid-cols-1 sm:grid-cols-[190px_1fr_44px] items-start sm:items-center gap-2 sm:gap-4"
                        >
                          <div className="flex items-center justify-between gap-2 sm:block min-w-0 w-full">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {course.title}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-[#A6A0CE] truncate">
                                {course.code} · {scanned ? 'QR verified' : 'Pending scan'}
                              </p>
                            </div>
                            <span className="sm:hidden text-xs font-extrabold font-mono tabular-nums text-slate-900 dark:text-white shrink-0">
                              {pct}%
                            </span>
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-[#EFEBFD] dark:bg-[#2A2454] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${barCls}`}
                              style={{ width: `${Math.max(4, pct)}%` }}
                            />
                          </div>
                          <span className="hidden sm:block text-xs font-extrabold font-mono tabular-nums text-right text-slate-900 dark:text-white">
                            {pct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              {/* Monthly Calendar Card */}
              <section className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    {monthGrid.monthLabel}
                  </span>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-[#A6A0CE]">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5346E8]" />
                      Class
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                      None
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <span
                      key={i}
                      className={`text-[10px] font-bold py-1 ${
                        i === 0 || i === 6
                          ? 'text-rose-400 dark:text-rose-300'
                          : 'text-slate-400 dark:text-[#8E88BE]'
                      }`}
                    >
                      {d}
                    </span>
                  ))}
                  {monthGrid.cells.map((cell, idx) =>
                    cell.day === null ? (
                      <div key={`sched-empty-${idx}`} className="h-7" />
                    ) : (
                      <div
                        key={cell.day}
                        className={`h-7 rounded-lg text-[11px] font-mono tabular-nums flex items-center justify-center ${
                          cell.isToday
                            ? 'bg-[#5346E8] text-white font-extrabold shadow-xs'
                            : cell.isWeekend
                            ? 'text-rose-500 dark:text-rose-300'
                            : 'bg-[#F4F2FC] dark:bg-[#241F4A] text-slate-800 dark:text-[#D1CCEE] font-semibold'
                        }`}
                      >
                        {cell.day}
                      </div>
                    )
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ================= MY ID / ATTENDANCE PASS ================= */}
        {activeTab === 'qrpass' && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveTab('calendar')}
                className="w-10 h-10 rounded-full bg-white dark:bg-[#1B1738] border border-[#E7E3FA] dark:border-[#2C2654] flex items-center justify-center text-slate-700 dark:text-white cursor-pointer"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Attendance Pass
              </h2>
              <button
                type="button"
                onClick={handleDownloadQR}
                aria-label="Download QR"
                className="w-10 h-10 rounded-full bg-white dark:bg-[#1B1738] border border-[#E7E3FA] dark:border-[#2C2654] flex items-center justify-center text-slate-700 dark:text-white cursor-pointer"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>

            {/* Segmented QR code / Barcode Toggle */}
            <div className="max-w-md mx-auto grid grid-cols-2 p-1 rounded-full bg-white dark:bg-[#1B1738] border border-[#E7E3FA] dark:border-[#2C2654]">
              <button
                type="button"
                onClick={() => setIdMode('qr')}
                className={`py-2.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  idMode === 'qr'
                    ? 'bg-[#171332] dark:bg-white text-white dark:text-[#171332] shadow-xs'
                    : 'text-slate-600 dark:text-[#A6A0CE]'
                }`}
              >
                ID & QR Pass
              </button>
              <button
                type="button"
                onClick={() => setIdMode('barcode')}
                className={`py-2.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  idMode === 'barcode'
                    ? 'bg-[#171332] dark:bg-white text-white dark:text-[#171332] shadow-xs'
                    : 'text-slate-600 dark:text-[#A6A0CE]'
                }`}
              >
                Barcode View
              </button>
            </div>

            {idMode === 'qr' ? (
              renderIdStyleQrCard()
            ) : (
              <section className="max-w-lg mx-auto bg-white dark:bg-[#1B1738] rounded-[28px] border border-[#E7E3FA] dark:border-[#2C2654] shadow-[0_20px_50px_-15px_rgba(81,66,230,0.2)] overflow-hidden">
                <div className="px-5 py-4 bg-gradient-to-r from-[#5B4CEB] to-[#4A3AD6] text-white flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <AttendlyLogo size="sm" showGlow={false} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold tracking-widest uppercase text-white/80">
                        STUDENT ID
                      </p>
                      <p className="text-sm font-extrabold tracking-tight truncate">
                        {studentName}
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-white/15 text-[11px] font-mono font-bold shrink-0">
                    {studentCode}
                  </span>
                </div>

                <div className="p-6 flex flex-col items-center gap-4">
                  <div className="w-full max-w-xs p-5 rounded-3xl bg-white border border-[#E7E3FA] shadow-xs flex flex-col items-center gap-2.5">
                    <div className="flex items-stretch justify-center gap-[2px] h-20">
                      {barcodeBars.map((w, i) => (
                        <div
                          key={i}
                          className="bg-[#141033] rounded-[1px]"
                          style={{ width: `${w * 2}px` }}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-mono font-extrabold tracking-[0.25em] text-[#141033]">
                      {studentCode}
                    </span>
                  </div>

                  <div className="px-3.5 py-1.5 rounded-full bg-[#ECE9FC] dark:bg-[#2A2454] text-[#5346E8] dark:text-[#BDB6FF] text-xs font-mono font-bold tabular-nums">
                    {attendedCourseIds.size} of {courses.length} subjects scanned
                  </div>
                </div>
              </section>
            )}

            {/* Last Scan Verified Banner */}
            {latestScan && (
              <div className="p-4 rounded-2xl bg-[#E6F7EE] dark:bg-[#143D2B] border border-emerald-200/70 dark:border-emerald-700/40 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#16A34A] text-white flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-[#15803D] dark:text-[#7CE4AF]">
                    Last scan verified ·{' '}
                    {new Date(latestScan.checkedInAt).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-200 truncate">
                    {latestScan.courseCode} · {latestScan.room}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= NOTICES / ANNOUNCEMENTS (PDF Pages 3 & 8) ================= */}
        {activeTab === 'announcements' && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Notices
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#A6A0CE]">
                  From your professors and the school · react only
                </p>
              </div>
              <div className="relative w-44 sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notices..."
                  className="w-full pl-8 pr-3 py-2 min-h-[38px] text-xs bg-white dark:bg-[#1B1738] border border-[#E7E3FA] dark:border-[#2C2654] rounded-full focus:outline-none text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Category Filter Pills (PDF Pages 3 & 8) */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'class_changes', label: 'Class changes' },
                  { id: 'quizzes', label: 'Quizzes' },
                  { id: 'school', label: 'School' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setNoticeCategoryFilter(cat.id)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                    noticeCategoryFilter === cat.id
                      ? 'bg-[#171332] dark:bg-white text-white dark:text-[#171332] shadow-xs'
                      : 'bg-white dark:bg-[#1B1738] text-slate-700 dark:text-[#D1CCEE] border border-[#E7E3FA] dark:border-[#2C2654]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Subject Unread Filter Chips */}
            {courses.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedSubjectFilter('all')}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                    selectedSubjectFilter === 'all'
                      ? 'bg-[#5346E8] text-white'
                      : 'bg-white dark:bg-[#1B1738] text-slate-600 dark:text-[#A6A0CE] border border-[#E7E3FA] dark:border-[#2C2654]'
                  }`}
                >
                  All subjects
                </button>
                {courses.map((c) => {
                  const unread = unreadCountByCourse.get(c.id) || 0;
                  const active = selectedSubjectFilter === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedSubjectFilter(c.id);
                        onMarkSubjectRead(c.id);
                      }}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-[#5346E8] text-white'
                          : 'bg-white dark:bg-[#1B1738] text-slate-700 dark:text-[#D1CCEE] border border-[#E7E3FA] dark:border-[#2C2654]'
                      }`}
                    >
                      <span>{c.code}</span>
                      {unread > 0 && (
                        <span className="min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                          {unread}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Notices Feed */}
            {filteredAnnouncements.length === 0 ? (
              <div className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-8 text-center text-xs text-slate-500 dark:text-[#A6A0CE]">
                No notices match this filter.
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredAnnouncements.map((ann) => {
                  const cat = categoryMeta(ann.category, ann.scope);
                  const isUnread = !readAnnouncementIds.includes(ann.id);
                  const stats = reactionStatsByAnn.get(ann.id) || {
                    gotIt: 0,
                    thanks: 0,
                    myGotIt: false,
                    myThanks: false,
                  };
                  const authorParts = ann.authorName.trim().split(/\s+/).filter(Boolean);
                  const authorInitials =
                    authorParts.length >= 2
                      ? `${authorParts[0][0]}${authorParts[authorParts.length - 1][0]}`.toUpperCase()
                      : ann.authorName.slice(0, 2).toUpperCase();

                  return (
                    <article
                      key={ann.id}
                      className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-4 sm:p-5 space-y-3 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-[#ECE9FC] dark:bg-[#2A2454] text-[#5346E8] dark:text-[#BDB6FF] text-xs font-extrabold flex items-center justify-center shrink-0">
                            {authorInitials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                              {ann.authorName}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-[#A6A0CE] truncate">
                              {ann.scope === 'official' ? 'All students' : ann.courseTitle} ·{' '}
                              {ann.activityDate ||
                                new Date(ann.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isUnread && (
                            <button
                              type="button"
                              onClick={() => onMarkAnnouncementRead(ann.id)}
                              className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold cursor-pointer"
                            >
                              New
                            </button>
                          )}
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${cat.cls}`}>
                            {cat.label}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                          {ann.title}
                        </h3>
                        <p className="text-xs sm:text-[13px] text-slate-600 dark:text-[#C8C2EA] leading-relaxed">
                          {ann.message}
                        </p>
                      </div>

                      <AnnouncementPhotoGallery
                        photos={photosByAnnouncementId.get(ann.id) || []}
                      />

                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void onToggleReaction(ann, 'gotIt')}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                            stats.myGotIt
                              ? 'bg-[#5346E8] text-white shadow-xs'
                              : 'bg-[#F5F3FE] dark:bg-[#241F4A] text-slate-700 dark:text-[#D1CCEE] border border-[#E7E3FA] dark:border-[#322B61]'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Got it {stats.gotIt > 0 ? stats.gotIt : ''}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void onToggleReaction(ann, 'thanks')}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                            stats.myThanks
                              ? 'bg-[#5346E8] text-white shadow-xs'
                              : 'bg-[#F5F3FE] dark:bg-[#241F4A] text-slate-700 dark:text-[#D1CCEE] border border-[#E7E3FA] dark:border-[#322B61]'
                          }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>Thanks {stats.thanks > 0 ? stats.thanks : ''}</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= PROFILE TAB (Mobile & Desktop) ================= */}
        {activeTab === 'profile' && (
          <div className="max-w-lg mx-auto space-y-4">
            <section className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-6 space-y-5 shadow-2xs">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-[#6B5BF7] to-[#5142E6] text-white flex items-center justify-center text-lg font-extrabold shrink-0">
                  {portraitSrc ? (
                    <img
                      src={portraitSrc}
                      alt={studentName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    studentInitials
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white truncate">
                    {studentName}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-[#A6A0CE] truncate">
                    {studentCode} · {department}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-[#8E88BE] truncate">
                    {user?.email}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-[#EFEBFD] dark:border-[#2C2654] space-y-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('qrpass')}
                  className="w-full py-3 px-4 rounded-2xl bg-[#F5F3FE] dark:bg-[#241F4A] text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-[#5346E8] dark:text-[#A399FF]" />
                    Open Attendance Pass
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => signOutUser()}
                  className="w-full py-3 px-4 rounded-2xl bg-[#FEE2E2] dark:bg-rose-950/50 text-xs font-bold text-[#BE123C] dark:text-rose-300 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Full-Screen Scannable Student ID & QR Modal */}
      {fullScreenIdOpen && (
        <div
          className="fixed inset-0 z-[60] bg-[#110E26]/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          onClick={() => setFullScreenIdOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[32px] overflow-hidden border border-white/15 shadow-2xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-br from-[#5240E8] via-[#412FC9] to-[#2F209E] p-6 text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-14 h-16 rounded-xl overflow-hidden bg-[#C7BEFF] border border-white/25 shrink-0 flex items-center justify-center">
                  {portraitSrc ? (
                    <img
                      src={portraitSrc}
                      alt={studentName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg viewBox="0 0 80 96" className="w-full h-full" aria-hidden="true">
                      <circle cx="40" cy="34" r="16" fill="#FFFFFF" />
                      <path
                        d="M12 96 C12 72, 24 58, 40 58 C56 58, 68 72, 68 96 Z"
                        fill="#FFFFFF"
                      />
                    </svg>
                  )}
                </div>
                <div className="min-w-0">
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/18 text-[9px] font-extrabold tracking-[0.14em] uppercase mb-1">
                    STUDENT ID
                  </span>
                  <p className="text-lg font-extrabold truncate">{studentName}</p>
                  <p className="text-xs font-mono font-bold text-white/90">{studentCode}</p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 flex flex-col items-center gap-5 bg-white text-slate-900">
              <div className="p-4 rounded-3xl border border-[#E7E3FA] bg-white shadow-sm">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`Full screen QR for ${studentName}`}
                    className="w-60 h-60 sm:w-64 sm:h-64 rounded-xl"
                  />
                ) : (
                  <div className="w-60 h-60 flex items-center justify-center text-xs text-slate-400">
                    Generating QR...
                  </div>
                )}
              </div>

              <div className="text-center space-y-0.5">
                <p className="text-xs font-bold text-slate-800">{department}</p>
                <p className="text-[11px] text-slate-500">
                  {user?.email || 'student@attendly.edu'}
                </p>
              </div>

              <div className="flex items-center gap-3 w-full">
                <button
                  type="button"
                  onClick={handleDownloadQR}
                  className="flex-1 py-3 px-4 rounded-full text-xs font-bold text-white bg-[#5346E8] hover:bg-[#4336D6] shadow-md shadow-[#5346E8]/25 inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Download QR</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFullScreenIdOpen(false)}
                  className="py-3 px-5 rounded-full text-xs font-bold text-slate-800 bg-[#F4F2FC] hover:bg-[#EAE6FA] border border-[#E7E3FA] cursor-pointer transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
