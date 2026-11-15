import React, { useState } from 'react';
import {
  Camera,
  CalendarClock,
  CheckSquare,
  BookOpen,
  MapPin,
  Clock,
  Megaphone,
  Plus,
  Play,
  Square,
  Sparkles,
  UserPlus,
  Trash2,
  ArrowLeft,
  Menu,
} from 'lucide-react';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  CourseRecord,
  ClassSessionRecord,
  AttendanceRecord,
  AttendanceStatus,
  AnnouncementRecord,
  DirectoryEntry,
} from '../../types/attendly';
import { DashboardTab } from '../Sidebar';
import { AttendlyLogo } from '../AttendlyLogo';
import { QRScannerModal } from '../QRScannerModal';
import { generateCheckInCode, seedCampusData } from '../../lib/attendlySeed';

interface ProfessorDashboardProps {
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  onOpenMenu: () => void;
  isAdminPreview?: boolean;
  onReturnToAdmin?: () => void;
  courses: CourseRecord[];
  sessions: ClassSessionRecord[];
  attendance: AttendanceRecord[];
  announcements: AnnouncementRecord[];
  directory: DirectoryEntry[];
  onNotify: (msg: string) => void;
}

export const ProfessorDashboard: React.FC<ProfessorDashboardProps> = ({
  activeTab,
  setActiveTab,
  onOpenMenu,
  isAdminPreview,
  onReturnToAdmin,
  courses,
  sessions,
  attendance,
  announcements,
  directory,
  onNotify,
}) => {
  const { user, userProfile } = useAuth();
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [showNewSession, setShowNewSession] = useState(false);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [studentNameInput, setStudentNameInput] = useState('');
  const [manualStatus, setManualStatus] = useState<AttendanceStatus>('present');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>('all');

  // Subject-only announcement state
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [postingAnn, setPostingAnn] = useState(false);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId) || courses[0] || null;

  const subjectSessions = selectedCourse
    ? sessions.filter((s) => s.courseId === selectedCourse.id)
    : sessions;
  const activeSessionForSubject =
    subjectSessions.find((s) => s.status === 'active') || subjectSessions[0] || sessions[0] || null;

  const subjectAttendance = selectedCourse
    ? attendance.filter((a) => a.courseId === selectedCourse.id)
    : attendance;

  const filteredAttendance =
    statusFilter === 'all'
      ? subjectAttendance
      : subjectAttendance.filter((a) => a.status === statusFilter);

  const presentOrLate = subjectAttendance.filter(
    (a) => a.status === 'present' || a.status === 'late'
  ).length;
  const attendanceRate =
    subjectAttendance.length > 0
      ? Math.round((presentOrLate / subjectAttendance.length) * 100)
      : 100;

  const subjectAnnouncements = announcements.filter(
    (a) => a.scope === 'subject' && (!selectedCourse || a.courseId === selectedCourse.id)
  );

  const handleSeed = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      await seedCampusData(user.uid, userProfile?.displayName || 'Prof. Alex Rivera');
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
      onNotify(`QR Scanned: ${scanned.studentName} marked Present in ${activeSessionForSubject.courseCode}`);
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
      professorName: userProfile?.displayName || 'Professor',
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
    if (!user || !selectedCourse || !annTitle.trim() || !annMessage.trim()) return;
    setPostingAnn(true);
    const annId = `ann_${Date.now()}`;

    const newAnnouncement: AnnouncementRecord = {
      id: annId,
      title: annTitle.trim(),
      message: annMessage.trim(),
      scope: 'subject',
      courseId: selectedCourse.id,
      courseCode: selectedCourse.code,
      courseTitle: selectedCourse.title,
      activityDate: new Date().toISOString().split('T')[0],
      authorId: user.uid,
      authorName: userProfile?.displayName || 'Professor',
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

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-[100dvh] lg:h-screen lg:overflow-y-auto bg-transparent relative z-10">
      {/* Frosted Top Header */}
      <header className="sticky top-0 z-20 bg-white/45 backdrop-blur-2xl border-b border-white/40 px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open menu"
            className="lg:hidden p-2.5 text-slate-800 bg-white/65 hover:bg-white rounded-xl border border-white/70 transition cursor-pointer shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="lg:hidden shrink-0">
            <AttendlyLogo size="sm" showGlow={false} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-extrabold text-slate-900 tracking-tight truncate">
              Professor Dashboard
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-700 font-medium truncate">
              Attendly · {userProfile?.displayName || 'Professor'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isAdminPreview && onReturnToAdmin && (
            <button
              onClick={onReturnToAdmin}
              className="px-3 py-2 min-h-[40px] text-xs font-semibold text-slate-800 bg-white/75 hover:bg-white border border-white rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back to Admin</span>
              <span className="sm:hidden">Admin</span>
            </button>
          )}
          {courses.length === 0 && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="px-3 py-2 min-h-[40px] text-xs font-semibold text-slate-800 bg-white/65 hover:bg-white/90 border border-white/75 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">{seeding ? 'Loading...' : 'Load Sample Schedule'}</span>
              <span className="sm:hidden">{seeding ? '...' : 'Sample'}</span>
            </button>
          )}
          <button
            onClick={() => {
              if (!activeSessionForSubject) {
                onNotify('Load or create a subject session before scanning QR codes');
                return;
              }
              setScannerOpen(true);
            }}
            className="px-3.5 sm:px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-blue-600/25 cursor-pointer whitespace-nowrap"
          >
            <Camera className="w-4 h-4" />
            <span>Scan QR</span>
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-5 sm:space-y-6 flex-1">
        {/* Subject Selector Bar */}
        {courses.length > 0 && (
          <section className="bg-white/55 backdrop-blur-2xl rounded-2xl border border-white/70 p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-900">Active Subject Context</p>
              <p className="text-[11px] text-slate-600 font-medium">
                QR scans, attendance logs, and announcements apply strictly to the selected subject
              </p>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full pb-1 sm:pb-0">
              {courses.map((c) => {
                const selected = selectedCourse?.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCourseId(c.id)}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition cursor-pointer whitespace-nowrap shrink-0 ${
                      selected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white/70 text-slate-800 border-white hover:bg-white'
                    }`}
                  >
                    {c.code}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Active Subject Camera QR Hero */}
        {selectedCourse && activeSessionForSubject && (
          <section className="bg-white/55 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-white/70 p-5 sm:p-6 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-1.5 min-w-0">
              <p className="text-xs font-bold text-blue-700">
                {activeSessionForSubject.status === 'active'
                  ? 'Live Classroom Session'
                  : 'Scheduled Subject Session'}
              </p>
              <h2 className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                {selectedCourse.code} · {selectedCourse.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-700 font-medium">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  {selectedCourse.building} · {selectedCourse.room}
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  {selectedCourse.startTime} – {selectedCourse.endTime}
                </span>
                <span aria-hidden="true">·</span>
                <span>{selectedCourse.scheduleDays || 'Mon · Wed · Fri'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => setScannerOpen(true)}
                className="px-5 py-3 min-h-[44px] text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Camera className="w-4 h-4" />
                <span>Open Camera QR Scanner</span>
              </button>

              {activeSessionForSubject.status === 'active' ? (
                <button
                  onClick={() => handleSessionStatus(activeSessionForSubject, 'completed')}
                  className="px-4 py-3 min-h-[44px] text-xs font-semibold text-slate-800 bg-white/80 hover:bg-white border border-white rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Close Session</span>
                </button>
              ) : (
                <button
                  onClick={() => handleSessionStatus(activeSessionForSubject, 'active')}
                  className="px-4 py-3 min-h-[44px] text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Activate Session</span>
                </button>
              )}
            </div>
          </section>
        )}

        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white/50 backdrop-blur-2xl p-4 rounded-2xl border border-white/60 shadow-lg shadow-blue-950/5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50/85 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600">Teaching Subjects</p>
              <p className="text-xl font-extrabold text-slate-900 font-mono tabular-nums">{courses.length}</p>
            </div>
          </div>

          <div className="bg-white/50 backdrop-blur-2xl p-4 rounded-2xl border border-white/60 shadow-lg shadow-blue-950/5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50/85 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600">
                {selectedCourse ? `${selectedCourse.code} Attendance` : 'Subject Attendance'}
              </p>
              <p className="text-xl font-extrabold text-slate-900 font-mono tabular-nums">{attendanceRate}%</p>
            </div>
          </div>

          <div className="bg-white/50 backdrop-blur-2xl p-4 rounded-2xl border border-white/60 shadow-lg shadow-blue-950/5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50/85 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600">Subject Announcements</p>
              <p className="text-xl font-extrabold text-slate-900 font-mono tabular-nums">
                {subjectAnnouncements.length}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher + New Session Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-white/45 backdrop-blur-xl rounded-xl border border-white/60 overflow-x-auto no-scrollbar max-w-full">
            {(
              [
                { id: 'schedule', label: 'Schedule & QR Scan' },
                { id: 'attendance', label: 'Subject Attendance' },
                { id: 'announcements', label: 'Subject Announcements' },
              ] as { id: DashboardTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 text-xs font-semibold rounded-lg transition cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {selectedCourse && (
            <button
              onClick={() => setShowNewSession(!showNewSession)}
              className="px-3.5 py-2 min-h-[40px] text-xs font-semibold text-slate-800 bg-white/65 hover:bg-white/90 border border-white/75 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap w-full sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Session for {selectedCourse.code}</span>
            </button>
          )}
        </div>

        {showNewSession && selectedCourse && (
          <form
            onSubmit={handleStartSession}
            className="bg-white/55 backdrop-blur-2xl rounded-2xl border border-white/70 p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row sm:items-center gap-3"
          >
            <div className="text-xs font-bold text-slate-900 flex-1">
              New Session: {selectedCourse.code} · {selectedCourse.building} {selectedCourse.room}
            </div>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="px-3.5 py-2 min-h-[42px] text-xs bg-white/80 border border-white rounded-xl"
            />
            <button
              type="submit"
              className="px-4 py-2 min-h-[42px] text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer whitespace-nowrap"
            >
              Create & Activate
            </button>
          </form>
        )}

        {/* Teaching Schedule View */}
        {activeTab === 'schedule' && (
          <section className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 p-4 sm:p-6 shadow-lg shadow-blue-950/5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/40">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Teaching Schedule</h3>
                <p className="text-xs text-slate-600 font-medium">
                  Your classes, rooms, and quick QR scanning access
                </p>
              </div>
              <CalendarClock className="w-4 h-4 text-slate-500 shrink-0" />
            </div>

            {courses.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <p className="text-sm font-semibold text-slate-700">No subjects scheduled yet.</p>
                <button
                  onClick={handleSeed}
                  disabled={seeding}
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
                >
                  {seeding ? 'Loading...' : 'Populate Sample Teaching Schedule'}
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/40">
                {courses.map((course) => {
                  const isSelected = selectedCourse?.id === course.id;
                  const courseCount = attendance.filter((a) => a.courseId === course.id).length;

                  return (
                    <div
                      key={course.id}
                      onClick={() => setSelectedCourseId(course.id)}
                      className={`py-3.5 px-3 -mx-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition cursor-pointer ${
                        isSelected ? 'bg-white/45' : 'hover:bg-white/25'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-slate-900">
                          <span className="font-mono text-blue-700">{course.code}</span>
                          <span aria-hidden="true">·</span>
                          <span>{course.title}</span>
                        </div>
                        <p className="text-xs text-slate-700 mt-1 font-medium">
                          {course.building} · {course.room} · {course.scheduleDays} ·{' '}
                          <span className="font-mono tabular-nums">
                            {course.startTime} – {course.endTime}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <span className="text-xs font-mono tabular-nums text-slate-700 font-semibold">
                          {courseCount} check-ins
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCourseId(course.id);
                            setScannerOpen(true);
                          }}
                          className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Scan QR</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Subject-Specific Attendance */}
        {(activeTab === 'schedule' || activeTab === 'attendance') && (
          <section className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 p-4 sm:p-6 shadow-lg shadow-blue-950/5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-white/40">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {selectedCourse ? `${selectedCourse.code} Attendance` : 'Subject Attendance'}
                </h3>
                <p className="text-xs text-slate-600 font-medium">
                  Students recorded via QR scan or manual roll call for this subject
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-white/45 rounded-xl border border-white/60 overflow-x-auto no-scrollbar max-w-full w-fit">
                {(['all', 'present', 'late', 'absent', 'excused'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg capitalize cursor-pointer whitespace-nowrap shrink-0 ${
                      statusFilter === status ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-700'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {activeSessionForSubject && (
              <form onSubmit={handleManualRollCall} className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={studentNameInput}
                  onChange={(e) => setStudentNameInput(e.target.value)}
                  placeholder={`Log student in ${activeSessionForSubject.courseCode}...`}
                  className="flex-1 px-3.5 py-2.5 min-h-[42px] text-xs bg-white/75 border border-white rounded-xl focus:outline-none text-slate-900"
                />
                <select
                  value={manualStatus}
                  onChange={(e) => setManualStatus(e.target.value as AttendanceStatus)}
                  className="px-3 py-2.5 min-h-[42px] text-xs bg-white/75 border border-white rounded-xl font-semibold text-slate-800"
                >
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                  <option value="excused">Excused</option>
                </select>
                <button
                  type="submit"
                  className="px-4 py-2.5 min-h-[42px] text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Entry</span>
                </button>
              </form>
            )}

            {filteredAttendance.length === 0 ? (
              <p className="text-xs text-slate-600 py-6 text-center font-medium">
                No attendance records yet for {selectedCourse?.code || 'this subject'}. Click Scan QR above to scan a student.
              </p>
            ) : (
              <div className="divide-y divide-white/40">
                {filteredAttendance.map((rec) => (
                  <div
                    key={rec.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{rec.studentName}</p>
                      <p className="text-slate-600 font-medium">
                        {rec.courseCode} · {rec.scanMethod === 'qr' ? 'QR Scanned' : 'Manual Entry'} ·{' '}
                        <span className="font-mono tabular-nums">
                          {new Date(rec.checkedInAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {(['present', 'late', 'absent', 'excused'] as AttendanceStatus[]).map((st) => (
                        <button
                          key={st}
                          onClick={() => handleChangeAttendanceStatus(rec, st)}
                          className={`px-2.5 py-1.5 rounded-lg font-semibold capitalize transition cursor-pointer ${
                            rec.status === st
                              ? st === 'present'
                                ? 'bg-emerald-600 text-white'
                                : st === 'late'
                                ? 'bg-amber-600 text-white'
                                : st === 'absent'
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-700 text-white'
                              : 'bg-white/65 text-slate-700 hover:bg-white'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Subject-Only Announcement Composer & List */}
        {(activeTab === 'schedule' || activeTab === 'announcements') && selectedCourse && (
          <section className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 p-4 sm:p-6 shadow-lg shadow-blue-950/5 space-y-4">
            <div className="pb-3 border-b border-white/40">
              <h3 className="text-base font-extrabold text-slate-900">
                Post Announcement for {selectedCourse.code} Only
              </h3>
              <p className="text-xs text-slate-600 font-medium">
                Only students viewing {selectedCourse.code} ({selectedCourse.title}) receive a notification badge for this update
              </p>
            </div>

            <form onSubmit={handlePostSubjectAnnouncement} className="space-y-3">
              <input
                type="text"
                required
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder={`Announcement title for ${selectedCourse.code}...`}
                className="w-full px-3.5 py-2.5 min-h-[44px] text-sm bg-white/75 border border-white rounded-xl focus:outline-none text-slate-900"
              />
              <textarea
                required
                rows={3}
                value={annMessage}
                onChange={(e) => setAnnMessage(e.target.value)}
                placeholder={`Instructions, room reminders, or assignment notes for ${selectedCourse.code}...`}
                className="w-full px-3.5 py-2.5 text-sm bg-white/75 border border-white rounded-xl focus:outline-none text-slate-900"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={postingAnn}
                  className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/25 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  <span>{postingAnn ? 'Posting...' : `Post to ${selectedCourse.code}`}</span>
                </button>
              </div>
            </form>

            <div className="pt-3 border-t border-white/40 space-y-2">
              <h4 className="text-xs font-bold text-slate-700">
                {selectedCourse.code} Announcements ({subjectAnnouncements.length})
              </h4>
              {subjectAnnouncements.length === 0 ? (
                <p className="text-xs text-slate-600 py-4 text-center font-medium">
                  No announcements posted for {selectedCourse.code} yet.
                </p>
              ) : (
                <div className="divide-y divide-white/40">
                  {subjectAnnouncements.map((ann) => (
                    <div key={ann.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">{ann.title}</p>
                        <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{ann.message}</p>
                        <p className="text-[11px] text-slate-600 mt-1 font-medium">
                          {ann.courseCode} · {ann.authorName} ·{' '}
                          <span className="font-mono tabular-nums">
                            {new Date(ann.createdAt).toLocaleDateString()}
                          </span>
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                        className="p-2 text-slate-500 hover:text-rose-600 hover:bg-white/70 rounded-xl transition cursor-pointer shrink-0"
                        title="Delete announcement"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <QRScannerModal
        isOpen={scannerOpen}
        session={activeSessionForSubject}
        directory={directory}
        onClose={() => setScannerOpen(false)}
        onScanStudent={handleScanStudentQR}
      />
    </div>
  );
};
