import React, { useMemo, useState } from 'react';
import {
  Camera,
  CalendarClock,
  CheckSquare,
  MapPin,
  Clock,
  Plus,
  Play,
  Square,
  Sparkles,
  UserPlus,
  Trash2,
  Sun,
  Moon,
  Bell,
  CheckCircle2,
  Send,
  LogOut,
  FileSpreadsheet,
} from 'lucide-react';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  CourseRecord,
  ClassSessionRecord,
  AttendanceRecord,
  AttendanceStatus,
  AnnouncementRecord,
  AnnouncementCategory,
  AnnouncementReactionRecord,
  DirectoryEntry,
} from '../../types/attendly';
import { DashboardTab } from '../Sidebar';
import { QRScannerModal } from '../QRScannerModal';
import { generateCheckInCode, seedCampusData } from '../../lib/attendlySeed';

interface ProfessorDashboardProps {
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  courses: CourseRecord[];
  sessions: ClassSessionRecord[];
  attendance: AttendanceRecord[];
  announcements: AnnouncementRecord[];
  reactions: AnnouncementReactionRecord[];
  directory: DirectoryEntry[];
  scannerOpen: boolean;
  setScannerOpen: (open: boolean) => void;
  onNotify: (msg: string) => void;
}

const POST_CATEGORIES: { id: AnnouncementCategory; label: string }[] = [
  { id: 'info', label: 'Info' },
  { id: 'room_change', label: 'Room change' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'no_class', label: 'No class' },
];

export const ProfessorDashboard: React.FC<ProfessorDashboardProps> = ({
  activeTab,
  setActiveTab,
  courses,
  sessions,
  attendance,
  announcements,
  reactions,
  directory,
  scannerOpen,
  setScannerOpen,
  onNotify,
}) => {
  const { user, userProfile, signOutUser } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [seeding, setSeeding] = useState(false);
  const [showNewSession, setShowNewSession] = useState(false);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [studentNameInput, setStudentNameInput] = useState('');
  const [manualStatus, setManualStatus] = useState<AttendanceStatus>('present');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'late' | 'waiting'>('all');

  // Subject-only announcement state
  const [annCategory, setAnnCategory] = useState<AnnouncementCategory>('room_change');
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [postingAnn, setPostingAnn] = useState(false);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId) || courses[0] || null;

  const subjectSessions = selectedCourse
    ? sessions.filter((s) => s.courseId === selectedCourse.id)
    : sessions;
  const activeSessionForSubject =
    subjectSessions.find((s) => s.status === 'active') || subjectSessions[0] || sessions[0] || null;

  const subjectAttendance = useMemo(
    () =>
      selectedCourse
        ? attendance.filter((a) => a.courseId === selectedCourse.id)
        : attendance,
    [attendance, selectedCourse]
  );

  const presentCount = useMemo(
    () => subjectAttendance.filter((a) => a.status === 'present').length,
    [subjectAttendance]
  );
  const lateCount = useMemo(
    () => subjectAttendance.filter((a) => a.status === 'late').length,
    [subjectAttendance]
  );
  const classCapacity = selectedCourse?.enrolledCount || Math.max(subjectAttendance.length, 32);
  const checkedInTotal = presentCount + lateCount;
  const waitingCount = Math.max(0, classCapacity - checkedInTotal);

  const filteredAttendance = useMemo(() => {
    if (statusFilter === 'all') return subjectAttendance;
    if (statusFilter === 'waiting') {
      return subjectAttendance.filter((a) => a.status === 'absent' || a.status === 'excused');
    }
    return subjectAttendance.filter((a) => a.status === statusFilter);
  }, [subjectAttendance, statusFilter]);

  const latestVerifiedRecord = useMemo(() => {
    if (subjectAttendance.length === 0) return null;
    return [...subjectAttendance].sort((a, b) =>
      (b.checkedInAt || '').localeCompare(a.checkedInAt || '')
    )[0];
  }, [subjectAttendance]);

  const subjectAnnouncements = useMemo(
    () =>
      announcements.filter(
        (a) => a.scope === 'subject' && (!selectedCourse || a.courseId === selectedCourse.id)
      ),
    [announcements, selectedCourse]
  );

  const reactionStatsByAnn = useMemo(() => {
    const map = new Map<string, { gotIt: number; thanks: number }>();
    for (const r of reactions) {
      const entry = map.get(r.announcementId) || { gotIt: 0, thanks: 0 };
      if (r.gotIt) entry.gotIt += 1;
      if (r.thanks) entry.thanks += 1;
      map.set(r.announcementId, entry);
    }
    return map;
  }, [reactions]);

  // SVG Donut ring math
  const donutMetrics = useMemo(() => {
    const total = Math.max(1, presentCount + lateCount + waitingCount);
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const presentLen = (presentCount / total) * circumference;
    const lateLen = (lateCount / total) * circumference;
    return { radius, circumference, presentLen, lateLen };
  }, [presentCount, lateCount, waitingCount]);

  const profName = userProfile?.displayName || 'Professor';
  const profInitials = useMemo(() => {
    const parts = profName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'PR';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [profName]);

  const handleSeed = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      await seedCampusData(user.uid, profName);
      onNotify('Sample teaching schedule and subjects loaded');
    } finally {
      setSeeding(false);
    }
  };

  const handleScanStudentQR = async (scanned: {
    studentId: string;
    studentName: string;
    studentCode?: string;
  }) => {
    if (!user || !activeSessionForSubject) return;
    const todayStr = activeSessionForSubject.sessionDate || new Date().toISOString().split('T')[0];
    const recId = `att_${activeSessionForSubject.id}_${scanned.studentId.slice(0, 16)}`;

    const record: AttendanceRecord = {
      id: recId,
      sessionId: activeSessionForSubject.id,
      courseId: activeSessionForSubject.courseId,
      courseCode: activeSessionForSubject.courseCode,
      courseTitle: activeSessionForSubject.courseTitle,
      studentId: scanned.studentId,
      studentName: scanned.studentName,
      professorId: user.uid,
      room: activeSessionForSubject.room,
      building: activeSessionForSubject.building,
      sessionDate: todayStr,
      scanMethod: 'qr',
      status: 'present',
      checkedInAt: new Date().toISOString(),
      campusScope: 'attendly',
      createdBy: user.uid,
    };

    try {
      await setDoc(doc(db, 'attendance', recId), record);
      onNotify(
        `QR Scanned: ${scanned.studentName} marked Present in ${activeSessionForSubject.courseCode}`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `attendance/${recId}`);
    }
  };

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCourse) return;

    const sessionId = `sess_${Date.now()}`;
    const newSession: ClassSessionRecord = {
      id: sessionId,
      courseId: selectedCourse.id,
      courseCode: selectedCourse.code,
      courseTitle: selectedCourse.title,
      professorId: user.uid,
      professorName: profName,
      room: selectedCourse.room,
      building: selectedCourse.building,
      sessionDate,
      startTime: selectedCourse.startTime,
      endTime: selectedCourse.endTime,
      checkInCode: generateCheckInCode(),
      status: 'active',
      campusScope: 'attendly',
      createdBy: user.uid,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'sessions', sessionId), newSession);
      onNotify(`Active session started for ${selectedCourse.code}`);
      setShowNewSession(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `sessions/${sessionId}`);
    }
  };

  const handleSessionStatus = async (
    sess: ClassSessionRecord,
    status: 'scheduled' | 'active' | 'completed'
  ) => {
    try {
      await updateDoc(doc(db, 'sessions', sess.id), { status });
      onNotify(`${sess.courseCode} session ${status}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `sessions/${sess.id}`);
    }
  };

  const handleManualRollCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeSessionForSubject || !studentNameInput.trim()) return;
    const recId = `att_${Date.now()}`;
    const newRecord: AttendanceRecord = {
      id: recId,
      sessionId: activeSessionForSubject.id,
      courseId: activeSessionForSubject.courseId,
      courseCode: activeSessionForSubject.courseCode,
      courseTitle: activeSessionForSubject.courseTitle,
      studentId: `stu_${studentNameInput.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      studentName: studentNameInput.trim(),
      professorId: user.uid,
      room: activeSessionForSubject.room,
      building: activeSessionForSubject.building,
      sessionDate: activeSessionForSubject.sessionDate,
      scanMethod: 'manual',
      status: manualStatus,
      checkedInAt: new Date().toISOString(),
      campusScope: 'attendly',
      createdBy: user.uid,
    };

    try {
      await setDoc(doc(db, 'attendance', recId), newRecord);
      onNotify(`Recorded ${newRecord.studentName} in ${activeSessionForSubject.courseCode}`);
      setStudentNameInput('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `attendance/${recId}`);
    }
  };

  const handleChangeAttendanceStatus = async (rec: AttendanceRecord, status: AttendanceStatus) => {
    try {
      await updateDoc(doc(db, 'attendance', rec.id), {
        status,
        checkedInAt: new Date().toISOString(),
      });
      onNotify(`${rec.studentName} marked ${status}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `attendance/${rec.id}`);
    }
  };

  const handlePostSubjectAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCourse || !annMessage.trim()) return;
    setPostingAnn(true);
    const annId = `ann_${Date.now()}`;
    const resolvedTitle =
      annTitle.trim() ||
      `${selectedCourse.code} ${
        POST_CATEGORIES.find((c) => c.id === annCategory)?.label || 'Update'
      }`;

    const newAnnouncement: AnnouncementRecord = {
      id: annId,
      title: resolvedTitle,
      message: annMessage.trim(),
      scope: 'subject',
      category: annCategory,
      courseId: selectedCourse.id,
      courseCode: selectedCourse.code,
      courseTitle: selectedCourse.title,
      activityDate: new Date().toISOString().split('T')[0],
      authorId: user.uid,
      authorName: profName,
      authorRole: 'professor',
      campusScope: 'attendly',
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'announcements', annId), newAnnouncement);
      onNotify(`Announcement posted exclusively to ${selectedCourse.code}`);
      setAnnTitle('');
      setAnnMessage('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `announcements/${annId}`);
    } finally {
      setPostingAnn(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'announcements', id));
      onNotify('Subject announcement deleted');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `announcements/${id}`);
    }
  };

  const openScannerSafely = () => {
    if (!activeSessionForSubject) {
      onNotify('Load or create a subject session before scanning QR codes');
      return;
    }
    setScannerOpen(true);
  };

  const handleExportAttendanceExcel = () => {
    const recordsToExport = subjectAttendance.length > 0 ? subjectAttendance : attendance;
    if (recordsToExport.length === 0) {
      onNotify('No attendance records available to export yet');
      return;
    }

    const escapeCell = (raw: string | undefined) => {
      const value = String(raw || '').trim();
      const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
      return safe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    };

    const rowsHtml = recordsToExport
      .map((rec) => {
        const checkedDate = rec.sessionDate || new Date(rec.checkedInAt).toLocaleDateString();
        const checkedTime = new Date(rec.checkedInAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        return `<tr>
          <td>${escapeCell(rec.courseCode)}</td>
          <td>${escapeCell(rec.courseTitle || rec.courseCode)}</td>
          <td>${escapeCell(rec.studentName)}</td>
          <td>${escapeCell(rec.studentId)}</td>
          <td>${escapeCell(rec.room)}</td>
          <td>${escapeCell(rec.building)}</td>
          <td>${escapeCell(checkedDate)}</td>
          <td>${escapeCell(checkedTime)}</td>
          <td>${escapeCell(rec.scanMethod === 'qr' ? 'Camera QR' : rec.scanMethod || 'Manual')}</td>
          <td>${escapeCell(rec.status.toUpperCase())}</td>
        </tr>`;
      })
      .join('');

    const htmlWorkbook = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<style>
  table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
  th { background-color: #5346E8; color: #FFFFFF; font-weight: bold; padding: 8px 10px; border: 1px solid #D5D0FA; text-align: left; }
  td { padding: 6px 10px; border: 1px solid #E7E3FA; }
</style>
</head>
<body>
  <table>
    <thead>
      <tr>
        <th>Course Code</th>
        <th>Course Title</th>
        <th>Student Name</th>
        <th>Student ID</th>
        <th>Room</th>
        <th>Building</th>
        <th>Date</th>
        <th>Check-in Time</th>
        <th>Method</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;

    const blob = new Blob(['\ufeff', htmlWorkbook], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const slug = (selectedCourse?.code || 'ALL-SUBJECTS').replace(/\s+/g, '-');
    const dateStamp = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `Attendly-Attendance-${slug}-${dateStamp}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotify(`Exported ${recordsToExport.length} attendance record(s) to Excel`);
  };

  const todayDisplay = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 xl:h-full overflow-y-auto subtle-scrollbar smooth-scroll smooth-resize">
      {/* Unified Top Header (Desktop + Tablet + Mobile) with Single Top-Right Scan Student QR */}
      <header className="px-4 xl:px-7 pt-[max(1.35rem,env(safe-area-inset-top))] sm:pt-6 xl:pt-6 pb-2 flex items-center justify-between gap-3 smooth-resize">
        {/* Desktop Title + Current Date */}
        <div className="hidden xl:block min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Live attendance
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E6F7EE] dark:bg-[#143D2B] text-[#15803D] dark:text-[#7CE4AF] text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Scanner online
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#A6A0CE] font-medium mt-0.5 truncate">
            {todayDisplay}
          </p>
        </div>

        {/* Mobile & Tablet Identity + Current Date */}
        <div className="flex xl:hidden items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            aria-label="Open profile"
            className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6B5BF7] to-[#5142E6] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-md shadow-[#5142E6]/25 cursor-pointer"
          >
            {profInitials}
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500 dark:text-[#A6A0CE] truncate">
              {todayDisplay}
            </p>
            <h1 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
              {profName}
            </h1>
          </div>
        </div>

        {/* Top-Right Controls + Single Scan Student QR Button */}
        <div className="flex items-center gap-2 shrink-0">
          {courses.length === 0 && (
            <button
              type="button"
              onClick={handleSeed}
              disabled={seeding}
              className="hidden sm:flex px-3.5 py-2 min-h-[40px] text-xs font-semibold text-[#5346E8] dark:text-[#BDB6FF] bg-white dark:bg-[#1B1738] border border-[#E7E3FA] dark:border-[#2C2654] rounded-full items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{seeding ? 'Loading...' : 'Load Sample Schedule'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="xl:hidden w-10 h-10 rounded-full bg-white dark:bg-[#1B1738] border border-[#E7E3FA] dark:border-[#2C2654] flex items-center justify-center text-slate-700 dark:text-white cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('announcements')}
            aria-label="Announcements"
            className="xl:hidden w-10 h-10 rounded-full bg-white dark:bg-[#1B1738] border border-[#E7E3FA] dark:border-[#2C2654] flex items-center justify-center text-slate-700 dark:text-white cursor-pointer"
          >
            <Bell className="w-4 h-4" />
          </button>

          {/* The ONE Scan QR button: top-right on desktop; moved to center of bottom nav bar on tablet & mobile */}
          {courses.length > 0 && activeTab !== 'profile' && (
            <button
              type="button"
              onClick={openScannerSafely}
              className="hidden xl:flex px-5 py-2.5 min-h-[42px] text-xs font-bold text-white bg-gradient-to-r from-[#6B5BF7] to-[#5142E6] hover:from-[#5E4DF0] hover:to-[#4638D6] rounded-full shadow-md shadow-[#5142E6]/25 items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Camera className="w-4 h-4 shrink-0" />
              <span>Scan student QR</span>
            </button>
          )}
        </div>
      </header>

      <main className="px-4 xl:px-7 pt-3 xl:pt-4 pb-28 xl:pb-8 max-w-[1400px] w-full mx-auto space-y-5 flex-1 smooth-resize">
        {courses.length === 0 && (
          <div className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-6 text-center space-y-3">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              No teaching subjects scheduled yet
            </p>
            <button
              type="button"
              onClick={handleSeed}
              disabled={seeding}
              className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-[#6B5BF7] to-[#5142E6] rounded-full cursor-pointer"
            >
              {seeding ? 'Loading...' : 'Populate Sample Teaching Schedule'}
            </button>
          </div>
        )}

        {/* ================= LIVE ATTENDANCE VIEW (Synced Across All Screen Sizes) ================= */}
        {activeTab === 'schedule' && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5 items-start smooth-resize">
            {/* Left Column: Verified Student Banner + My Teaching Schedule + Class Roster */}
            <div className="space-y-5 min-w-0">
                {/* Verified Student Card */}
                {latestVerifiedRecord ? (
                  <section className="rounded-3xl bg-[#E6F7EE] dark:bg-[#143D2B] border border-emerald-200/70 dark:border-emerald-700/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 smooth-resize">
                    <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                      <div className="relative shrink-0">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white dark:bg-[#1B1738] text-[#15803D] dark:text-[#7CE4AF] font-extrabold text-base sm:text-lg flex items-center justify-center">
                          {latestVerifiedRecord.studentName.slice(0, 2).toUpperCase()}
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-white dark:fill-[#143D2B] absolute -bottom-0.5 -right-0.5" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <p className="text-[11px] font-extrabold tracking-wider uppercase text-[#15803D] dark:text-[#7CE4AF]">
                          VERIFIED STUDENT
                        </p>
                        <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white truncate">
                          {latestVerifiedRecord.studentName}
                        </h2>
                        <p className="text-xs text-slate-600 dark:text-emerald-200 truncate">
                          {latestVerifiedRecord.courseCode} · {latestVerifiedRecord.room}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="px-2.5 py-0.5 rounded-full bg-white dark:bg-[#1B1738] text-[#15803D] dark:text-[#7CE4AF] text-[11px] font-bold font-mono tabular-nums">
                            {latestVerifiedRecord.status} ·{' '}
                            {new Date(latestVerifiedRecord.checkedInAt).toLocaleTimeString([], {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-white/80 dark:bg-[#1B1738]/70 text-slate-700 dark:text-[#D1CCEE] text-[11px] font-semibold">
                            {latestVerifiedRecord.scanMethod === 'qr' ? 'Camera QR' : 'Manual Roll'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className="self-start sm:self-auto px-3.5 py-1.5 rounded-full bg-white dark:bg-[#1B1738] text-[#15803D] dark:text-[#7CE4AF] text-xs font-extrabold shrink-0">
                      Checked in
                    </span>
                  </section>
                ) : (
                  <section className="rounded-3xl bg-white dark:bg-[#1B1738] border border-[#E7E3FA] dark:border-[#2C2654] p-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#5346E8] dark:text-[#A399FF]">
                        LIVE SCANNER READY
                      </p>
                      <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">
                        {selectedCourse
                          ? `Ready to scan students for ${selectedCourse.code}`
                          : 'Load or select a subject'}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-[#A6A0CE] mt-0.5">
                        Use Scan student QR above to open your camera or enter a student ID manually.
                      </p>
                    </div>
                  </section>
                )}

                {/* Professor's Teaching Schedule right on Homepage */}
                {courses.length > 0 && (
                  <section className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-5 space-y-3.5 shadow-2xs">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                          My teaching schedule
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-[#A6A0CE]">
                          Select any subject below to switch live attendance & announcements
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('attendance')}
                        className="text-xs font-bold text-[#5346E8] dark:text-[#A399FF] hover:underline cursor-pointer"
                      >
                        Full schedule
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 smooth-resize">
                      {courses.map((course) => {
                        const isSelected = selectedCourse?.id === course.id;
                        const courseSess = sessions.find((s) => s.courseId === course.id);
                        const isLive = courseSess?.status === 'active';
                        const count = attendance.filter((a) => a.courseId === course.id).length;
                        return (
                          <button
                            key={course.id}
                            type="button"
                            onClick={() => setSelectedCourseId(course.id)}
                            className={`text-left p-3.5 rounded-2xl border transition cursor-pointer space-y-2 ${
                              isSelected
                                ? 'bg-[#ECE9FC] dark:bg-[#272152] border-[#6B5BF7] shadow-xs'
                                : 'bg-[#F7F6FE] dark:bg-[#241F4A] border-[#EFEBFD] dark:border-[#322B61] hover:border-[#C5BDF8]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="px-2.5 py-0.5 rounded-full bg-white dark:bg-[#1B1738] text-[#5346E8] dark:text-[#BDB6FF] text-[11px] font-mono font-bold">
                                {course.code}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isLive
                                    ? 'bg-[#E6F7EE] dark:bg-[#143D2B] text-[#15803D] dark:text-[#7CE4AF]'
                                    : 'bg-white dark:bg-[#1B1738] text-slate-600 dark:text-[#A6A0CE]'
                                }`}
                              >
                                {isLive ? 'Live now' : 'Scheduled'}
                              </span>
                            </div>
                            <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                              {course.title}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-[#A6A0CE] truncate flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0" />
                              {course.building} · {course.room}
                            </p>
                            <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-[#A6A0CE]">
                              <span>
                                {course.scheduleDays} · {course.startTime}
                              </span>
                              <span className="font-bold text-slate-700 dark:text-white">
                                {count} in
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Class Roster 3-Column Grid */}
                <section className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-5 space-y-4 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                        Class roster
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-[#A6A0CE]">
                        Updates live as each student scans in
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          { id: 'all', label: `All ${subjectAttendance.length}` },
                          { id: 'present', label: `Present ${presentCount}` },
                          { id: 'late', label: `Late ${lateCount}` },
                          { id: 'waiting', label: `Waiting ${waitingCount}` },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setStatusFilter(f.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                            statusFilter === f.id
                              ? 'bg-[#171332] dark:bg-white text-white dark:text-[#171332]'
                              : 'bg-[#F5F3FE] dark:bg-[#241F4A] text-slate-600 dark:text-[#A6A0CE]'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick Manual Roll Call */}
                  {activeSessionForSubject && (
                      <form onSubmit={handleManualRollCall} className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={studentNameInput}
                          onChange={(e) => setStudentNameInput(e.target.value)}
                          placeholder={`Add student manually to ${activeSessionForSubject.courseCode}...`}
                          className="flex-1 px-3.5 py-2 min-h-[40px] text-xs bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl focus:outline-none text-slate-900 dark:text-white"
                        />
                        <div className="flex gap-2">
                          <select
                            value={manualStatus}
                            onChange={(e) => setManualStatus(e.target.value as AttendanceStatus)}
                            className="flex-1 sm:flex-none px-3 py-2 min-h-[40px] text-xs bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl font-semibold text-slate-800 dark:text-white"
                          >
                            <option value="present">Present</option>
                            <option value="late">Late</option>
                            <option value="absent">Absent</option>
                            <option value="excused">Excused</option>
                          </select>
                          <button
                            type="submit"
                            className="px-4 py-2 min-h-[40px] text-xs font-bold text-white bg-[#5346E8] hover:bg-[#4638D6] rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Record</span>
                          </button>
                        </div>
                      </form>
                  )}

                  {filteredAttendance.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-[#A6A0CE] py-6 text-center">
                      No students in this status filter yet.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {filteredAttendance.map((rec) => {
                        const parts = rec.studentName.trim().split(/\s+/).filter(Boolean);
                        const initials =
                          parts.length >= 2
                            ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
                            : rec.studentName.slice(0, 2).toUpperCase();
                        return (
                          <div
                            key={rec.id}
                            className="p-3 rounded-2xl bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#EFEBFD] dark:border-[#322B61] flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-[#ECE9FC] dark:bg-[#312A61] text-[#5346E8] dark:text-[#BDB6FF] text-xs font-extrabold flex items-center justify-center shrink-0">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                                  {rec.studentName}
                                </p>
                                <p
                                  className={`text-[11px] font-bold capitalize font-mono tabular-nums ${
                                    rec.status === 'present'
                                      ? 'text-[#15803D] dark:text-[#7CE4AF]'
                                      : rec.status === 'late'
                                      ? 'text-[#B45309] dark:text-[#F8C871]'
                                      : 'text-slate-500 dark:text-[#A6A0CE]'
                                  }`}
                                >
                                  {rec.status} ·{' '}
                                  {new Date(rec.checkedInAt).toLocaleTimeString([], {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </div>
                            </div>

                            <select
                              aria-label={`Change status for ${rec.studentName}`}
                              value={rec.status}
                              onChange={(e) =>
                                void handleChangeAttendanceStatus(
                                  rec,
                                  e.target.value as AttendanceStatus
                                )
                              }
                              className="text-[11px] font-semibold bg-white dark:bg-[#1B1738] border border-[#E7E3FA] dark:border-[#322B61] rounded-lg px-1.5 py-1 text-slate-700 dark:text-white cursor-pointer"
                            >
                              <option value="present">Present</option>
                              <option value="late">Late</option>
                              <option value="absent">Absent</option>
                              <option value="excused">Excused</option>
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>

              {/* Right Column: Attendance Donut + Post an Announcement + Recent Posts */}
              <div className="flex flex-col md:grid md:grid-cols-2 xl:flex xl:flex-col gap-4 items-start smooth-resize">
                {/* Group Donut + Recent Posts tightly in Column 1 on tablet (md) */}
                <div className="contents md:flex md:flex-col md:gap-4 md:w-full md:order-1 xl:contents">
                {/* Attendance Donut Card */}
                <section className="order-1 w-full bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-5 flex items-center justify-between gap-4 shadow-2xs">
                  <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                    <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r={donutMetrics.radius}
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth="12"
                        className="text-[#ECE9FC] dark:text-[#2A2454]"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r={donutMetrics.radius}
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth="12"
                        strokeDasharray={`${donutMetrics.presentLen} ${donutMetrics.circumference}`}
                        strokeLinecap="round"
                        className="text-emerald-500"
                      />
                      {lateCount > 0 && (
                        <circle
                          cx="50"
                          cy="50"
                          r={donutMetrics.radius}
                          fill="transparent"
                          stroke="currentColor"
                          strokeWidth="12"
                          strokeDasharray={`${donutMetrics.lateLen} ${donutMetrics.circumference}`}
                          strokeDashoffset={-donutMetrics.presentLen}
                          strokeLinecap="round"
                          className="text-amber-500"
                        />
                      )}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-lg font-extrabold font-mono tabular-nums text-slate-900 dark:text-white leading-none">
                        {checkedInTotal}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-[#A6A0CE] font-medium mt-0.5">
                        of {classCapacity} in
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-slate-600 dark:text-[#D1CCEE] font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Present
                      </span>
                      <span className="font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                        {presentCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-slate-600 dark:text-[#D1CCEE] font-medium">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Late
                      </span>
                      <span className="font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                        {lateCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-slate-600 dark:text-[#D1CCEE] font-medium">
                        <span className="w-2 h-2 rounded-full bg-[#D8D3F8] dark:bg-[#49427B]" />
                        Waiting
                      </span>
                      <span className="font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                        {waitingCount}
                      </span>
                    </div>
                  </div>
                </section>

                {/* Your Recent Posts (tightly below Donut on tablet mode) */}
                <section className="order-3 md:order-2 xl:order-3 w-full bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-5 space-y-3 shadow-2xs">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Your recent posts
                  </h3>
                  {subjectAnnouncements.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-[#A6A0CE] py-3 text-center">
                      No subject notices yet.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {subjectAnnouncements.slice(0, 4).map((ann) => {
                        const stats = reactionStatsByAnn.get(ann.id) || { gotIt: 0, thanks: 0 };
                        return (
                          <div
                            key={ann.id}
                            className="p-3 rounded-2xl bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#EFEBFD] dark:border-[#322B61] flex items-start justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                                {ann.title}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-[#A6A0CE] font-mono tabular-nums mt-0.5">
                                {ann.courseCode} · {stats.gotIt} got it · {stats.thanks} thanks
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleDeleteAnnouncement(ann.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer shrink-0"
                              title="Delete post"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
                </div>

                {/* Post an Announcement Card (Subject-scoped) */}
                {selectedCourse && (
                  <section className="order-2 md:order-2 w-full bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-5 space-y-3.5 shadow-2xs">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      Post an announcement
                    </h3>

                    <form onSubmit={handlePostSubjectAnnouncement} className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-[#A6A0CE] mb-1">
                          Send to
                        </label>
                        <select
                          value={selectedCourse.id}
                          onChange={(e) => setSelectedCourseId(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-bold bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl text-slate-900 dark:text-white"
                        >
                          {courses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.code} · {c.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {POST_CATEGORIES.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setAnnCategory(cat.id)}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                              annCategory === cat.id
                                ? 'bg-[#171332] dark:bg-white text-white dark:text-[#171332]'
                                : 'bg-[#F5F3FE] dark:bg-[#241F4A] text-slate-600 dark:text-[#A6A0CE]'
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>

                      <input
                        type="text"
                        value={annTitle}
                        onChange={(e) => setAnnTitle(e.target.value)}
                        placeholder={`Headline for ${selectedCourse.code}...`}
                        className="w-full px-3 py-2 text-xs bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl focus:outline-none text-slate-900 dark:text-white"
                      />

                      <textarea
                        required
                        rows={3}
                        value={annMessage}
                        onChange={(e) => setAnnMessage(e.target.value)}
                        placeholder={`Share updates with ${selectedCourse.code} students...`}
                        className="w-full px-3 py-2 text-xs bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl focus:outline-none text-slate-900 dark:text-white"
                      />

                      <div className="flex justify-end pt-0.5">
                        <button
                          type="submit"
                          disabled={postingAnn}
                          className="px-4 py-2 rounded-full text-xs font-bold text-white bg-gradient-to-r from-[#6B5BF7] to-[#5142E6] hover:from-[#5E4DF0] hover:to-[#4638D6] flex items-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{postingAnn ? 'Posting...' : 'Post'}</span>
                        </button>
                      </div>
                    </form>
                  </section>
                )}
              </div>
          </div>
        )}

        {/* ================= MY CLASSES / SUBJECT ATTENDANCE TAB ================= */}
        {activeTab === 'attendance' && (
          <div className="space-y-5">
            {/* Teaching Schedule Cards + Export Excel / Session Toolbar */}
            <section className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <CalendarClock className="w-5 h-5 text-[#5346E8] dark:text-[#A399FF] shrink-0" />
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                      My classes & schedule
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-[#A6A0CE]">
                      Select a subject to manage sessions, export Excel, or scan QR codes
                    </p>
                  </div>
                </div>

                {courses.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleExportAttendanceExcel}
                      className="px-3.5 py-2 min-h-[38px] text-xs font-bold bg-[#E6F7EE] dark:bg-[#143D2B] hover:opacity-90 rounded-full text-[#15803D] dark:text-[#7CE4AF] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Export Excel</span>
                    </button>

                    {selectedCourse && activeSessionForSubject && (
                      activeSessionForSubject.status === 'active' ? (
                        <button
                          type="button"
                          onClick={() => handleSessionStatus(activeSessionForSubject, 'completed')}
                          className="px-3.5 py-2 min-h-[38px] text-xs font-bold bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-full text-slate-700 dark:text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Square className="w-3 h-3" />
                          <span>Close Session</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSessionStatus(activeSessionForSubject, 'active')}
                          className="px-3.5 py-2 min-h-[38px] text-xs font-bold bg-[#E6F7EE] dark:bg-[#143D2B] text-[#15803D] dark:text-[#7CE4AF] rounded-full flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Play className="w-3 h-3" />
                          <span>Activate Session</span>
                        </button>
                      )
                    )}

                    {selectedCourse && (
                      <button
                        type="button"
                        onClick={() => setShowNewSession(!showNewSession)}
                        className="px-3.5 py-2 min-h-[38px] text-xs font-bold bg-[#ECE9FC] dark:bg-[#2A2454] rounded-full text-[#5346E8] dark:text-[#BDB6FF] flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New Session</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {showNewSession && selectedCourse && (
                <form
                  onSubmit={handleStartSession}
                  className="bg-[#F7F6FE] dark:bg-[#241F4A] rounded-2xl border border-[#E7E3FA] dark:border-[#322B61] p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex-1">
                    New Session: {selectedCourse.code} · {selectedCourse.building} {selectedCourse.room}
                  </div>
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="px-3.5 py-2 min-h-[40px] text-xs bg-white dark:bg-[#1B1738] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl text-slate-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 min-h-[40px] text-xs font-bold text-white bg-gradient-to-r from-[#6B5BF7] to-[#5142E6] rounded-full cursor-pointer whitespace-nowrap"
                  >
                    Create & Activate
                  </button>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {courses.map((course) => {
                  const selected = selectedCourse?.id === course.id;
                  const count = attendance.filter((a) => a.courseId === course.id).length;
                  return (
                    <div
                      key={course.id}
                      onClick={() => setSelectedCourseId(course.id)}
                      className={`p-4 rounded-2xl border transition cursor-pointer space-y-3 ${
                        selected
                          ? 'bg-[#ECE9FC] dark:bg-[#272152] border-[#6B5BF7]'
                          : 'bg-[#F7F6FE] dark:bg-[#241F4A] border-[#EFEBFD] dark:border-[#322B61]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-white dark:bg-[#1B1738] text-[#5346E8] dark:text-[#BDB6FF] text-xs font-mono font-bold">
                          {course.code}
                        </span>
                        <span className="text-xs font-mono tabular-nums font-bold text-slate-600 dark:text-[#A6A0CE]">
                          {count} check-ins
                        </span>
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {course.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-[#A6A0CE] mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          {course.building} · {course.room}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-[#A6A0CE] mt-0.5 flex items-center gap-1 font-mono tabular-nums">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          {course.scheduleDays} · {course.startTime}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-slate-500 dark:text-[#A6A0CE]">
                          {selected ? 'Selected for live scan & notices' : 'Click to select subject'}
                        </span>
                        <span className="font-bold text-[#5346E8] dark:text-[#BDB6FF]">
                          {selected ? 'Active' : 'Select'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Subject Attendance Roster */}
            <section className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {selectedCourse ? `${selectedCourse.code} Attendance Log` : 'Attendance Log'}
                </h3>
                <span className="text-xs font-mono tabular-nums font-bold text-[#5346E8] dark:text-[#BDB6FF]">
                  {subjectAttendance.length} recorded
                </span>
              </div>
              {subjectAttendance.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-[#A6A0CE] py-4 text-center">
                  No attendance entries yet for this subject.
                </p>
              ) : (
                <div className="divide-y divide-[#EFEBFD] dark:divide-[#2C2654]">
                  {subjectAttendance.map((rec) => (
                    <div
                      key={rec.id}
                      className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-extrabold text-slate-900 dark:text-white">
                          {rec.studentName}
                        </p>
                        <p className="text-slate-500 dark:text-[#A6A0CE] font-mono tabular-nums">
                          {rec.courseCode} · {rec.scanMethod === 'qr' ? 'QR Scanned' : 'Manual'} ·{' '}
                          {new Date(rec.checkedInAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {(['present', 'late', 'absent', 'excused'] as AttendanceStatus[]).map(
                          (st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => void handleChangeAttendanceStatus(rec, st)}
                              className={`px-2.5 py-1 rounded-full font-bold capitalize cursor-pointer ${
                                rec.status === st
                                  ? 'bg-[#5346E8] text-white'
                                  : 'bg-[#F5F3FE] dark:bg-[#241F4A] text-slate-600 dark:text-[#A6A0CE]'
                              }`}
                            >
                              {st}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ================= SUBJECT ANNOUNCEMENTS TAB (Mobile & Desktop) ================= */}
        {activeTab === 'announcements' && selectedCourse && (
          <div className="max-w-2xl mx-auto space-y-5">
            <section className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-5 space-y-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Post announcement for {selectedCourse.code}
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#A6A0CE]">
                  Only students enrolled in {selectedCourse.code} receive a subject notification badge.
                </p>
              </div>

              <form onSubmit={handlePostSubjectAnnouncement} className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {POST_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setAnnCategory(cat.id)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                        annCategory === cat.id
                          ? 'bg-[#171332] dark:bg-white text-white dark:text-[#171332]'
                          : 'bg-[#F5F3FE] dark:bg-[#241F4A] text-slate-600 dark:text-[#A6A0CE]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  required
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder={`Headline for ${selectedCourse.code}...`}
                  className="w-full px-3.5 py-2.5 min-h-[44px] text-sm bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl focus:outline-none text-slate-900 dark:text-white"
                />
                <textarea
                  required
                  rows={3}
                  value={annMessage}
                  onChange={(e) => setAnnMessage(e.target.value)}
                  placeholder={`Instructions, room changes, or quiz notes for ${selectedCourse.code}...`}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl focus:outline-none text-slate-900 dark:text-white"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={postingAnn}
                    className="px-5 py-2.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-[#6B5BF7] to-[#5142E6] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{postingAnn ? 'Posting...' : `Post to ${selectedCourse.code}`}</span>
                  </button>
                </div>
              </form>
            </section>

            <section className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-5 space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                {selectedCourse.code} Announcements ({subjectAnnouncements.length})
              </h3>
              {subjectAnnouncements.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-[#A6A0CE] py-4 text-center">
                  No announcements posted for {selectedCourse.code} yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {subjectAnnouncements.map((ann) => {
                    const stats = reactionStatsByAnn.get(ann.id) || { gotIt: 0, thanks: 0 };
                    return (
                      <div
                        key={ann.id}
                        className="p-3.5 rounded-2xl bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#EFEBFD] dark:border-[#322B61] flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                            {ann.title}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-[#C8C2EA]">
                            {ann.message}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-[#A6A0CE] font-mono tabular-nums">
                            {stats.gotIt} got it · {stats.thanks} thanks ·{' '}
                            {new Date(ann.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteAnnouncement(ann.id)}
                          className="p-2 text-slate-400 hover:text-rose-500 rounded-xl cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ================= PROFILE TAB ================= */}
        {activeTab === 'profile' && (
          <div className="max-w-lg mx-auto">
            <section className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-6 space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6B5BF7] to-[#5142E6] text-white flex items-center justify-center text-lg font-extrabold shrink-0">
                  {profInitials}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white truncate">
                    {profName}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-[#A6A0CE]">
                    Professor · {courses.length} active subjects
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-[#8E88BE] truncate">
                    {user?.email}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-[#EFEBFD] dark:border-[#2C2654] space-y-3">
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

      <QRScannerModal
        isOpen={scannerOpen}
        session={activeSessionForSubject}
        directory={directory}
        presentCount={presentCount}
        lateCount={lateCount}
        waitingCount={waitingCount}
        onClose={() => setScannerOpen(false)}
        onScanStudent={handleScanStudentQR}
      />
    </div>
  );
};
