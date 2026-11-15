import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  MapPin,
  Clock,
  CheckCircle2,
  CalendarDays,
  Megaphone,
  QrCode,
  Sparkles,
  ArrowLeft,
  Menu,
  Camera,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  CourseRecord,
  ClassSessionRecord,
  AttendanceRecord,
  AnnouncementRecord,
  AnnouncementPhotoRecord,
  StudentQRPayload,
} from '../../types/attendly';
import { DashboardTab } from '../Sidebar';
import { AttendlyLogo } from '../AttendlyLogo';
import { AnnouncementPhotoGallery } from '../AnnouncementPhotoGallery';
import { deriveStudentCode, seedCampusData } from '../../lib/attendlySeed';
import { compressIdPortraitToDataUrl } from '../../lib/imageUpload';

interface StudentDashboardProps {
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  onOpenMenu: () => void;
  isAdminPreview?: boolean;
  onReturnToAdmin?: () => void;
  courses: CourseRecord[];
  sessions: ClassSessionRecord[];
  attendance: AttendanceRecord[];
  announcements: AnnouncementRecord[];
  announcementPhotos: AnnouncementPhotoRecord[];
  readAnnouncementIds: string[];
  onMarkSubjectRead: (courseId: string) => void;
  onMarkAnnouncementRead: (announcementId: string) => void;
  onNotify: (msg: string) => void;
}

const WEEK_DAYS = [
  { short: 'Mon', label: 'Monday' },
  { short: 'Tue', label: 'Tuesday' },
  { short: 'Wed', label: 'Wednesday' },
  { short: 'Thu', label: 'Thursday' },
  { short: 'Fri', label: 'Friday' },
];

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  activeTab,
  setActiveTab,
  onOpenMenu,
  isAdminPreview,
  onReturnToAdmin,
  courses,
  attendance,
  announcements,
  announcementPhotos,
  readAnnouncementIds,
  onMarkSubjectRead,
  onMarkAnnouncementRead,
  onNotify,
}) => {
  const { user, userProfile, updateUserPhoto } = useAuth();
  const idPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [seeding, setSeeding] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [portraitLoadFailed, setPortraitLoadFailed] = useState(false);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('all');

  const studentId = user?.uid || 'student';
  const studentName = userProfile?.displayName || user?.email?.split('@')[0] || 'Student';
  const studentCode = userProfile?.studentCode || deriveStudentCode(studentId);
  const department = userProfile?.department || 'Computer Science';
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
      width: 260,
      margin: 2,
      color: {
        dark: '#0F172A',
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

  const myAttendance = attendance.filter((a) => a.studentId === studentId);
  const attendedCourseIds = useMemo(() => {
    const set = new Set<string>();
    for (const rec of myAttendance) {
      if (rec.status === 'present' || rec.status === 'late') {
        set.add(rec.courseId);
      }
    }
    return set;
  }, [myAttendance]);

  const officialAnnouncements = announcements.filter((a) => a.scope === 'official');
  const subjectAnnouncements = announcements.filter((a) => a.scope === 'subject');

  const photosByAnnouncementId = useMemo(() => {
    const map = new Map<string, AnnouncementPhotoRecord[]>();
    for (const photo of announcementPhotos) {
      const existing = map.get(photo.announcementId) || [];
      existing.push(photo);
      map.set(photo.announcementId, existing);
    }
    return map;
  }, [announcementPhotos]);

  const unreadCountByCourse = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ann of subjectAnnouncements) {
      if (!readAnnouncementIds.includes(ann.id)) {
        counts.set(ann.courseId, (counts.get(ann.courseId) || 0) + 1);
      }
    }
    return counts;
  }, [subjectAnnouncements, readAnnouncementIds]);

  const todayShort = new Date().toLocaleDateString('en-US', { weekday: 'short' });

  const handleIdPhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const compressed = await compressIdPortraitToDataUrl(file);
      await updateUserPhoto(compressed);
      setPortraitLoadFailed(false);
      onNotify('Student ID photo updated');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Unable to update ID photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSeed = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      await seedCampusData(user.uid, studentName);
      onNotify('Student schedule calendar and campus announcements loaded');
    } finally {
      setSeeding(false);
    }
  };

  const handleInspectSubjectAnnouncements = (courseId: string) => {
    setSelectedSubjectFilter(courseId);
    onMarkSubjectRead(courseId);
    setActiveTab('announcements');
  };

  const visibleSubjectAnnouncements =
    selectedSubjectFilter === 'all'
      ? subjectAnnouncements
      : subjectAnnouncements.filter((a) => a.courseId === selectedSubjectFilter);

  const visibleWeekDays =
    selectedDayFilter === 'all'
      ? WEEK_DAYS
      : WEEK_DAYS.filter((d) => d.short === selectedDayFilter);

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
              Student Dashboard
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-700 font-medium truncate">
              Attendly · {studentName}
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
            onClick={() => setActiveTab('qrpass')}
            className="px-3.5 sm:px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-blue-600/25 cursor-pointer whitespace-nowrap"
          >
            <QrCode className="w-4 h-4" />
            <span>My QR</span>
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-5 sm:space-y-6 flex-1">
        {/* Student ID Card — Attendance Pass */}
        {(activeTab === 'calendar' || activeTab === 'qrpass') && (
          <section className="bg-white/60 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-white/80 shadow-xl overflow-hidden">
            {/* ID Card Header Strip */}
            <div className="px-5 sm:px-6 py-3.5 bg-gradient-to-r from-slate-900/90 via-slate-800/90 to-blue-950/90 text-white flex flex-wrap items-center justify-between gap-3 border-b border-white/25">
              <div className="flex items-center gap-2.5">
                <AttendlyLogo size="sm" showGlow={false} />
                <div>
                  <p className="text-sm font-extrabold tracking-tight leading-tight">
                    Attendance Pass
                  </p>
                  <p className="text-[11px] text-slate-200 font-medium">
                    Attendly Student Identification
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-slate-300 font-medium">ID Number</p>
                <p className="text-xs sm:text-sm font-mono font-bold tabular-nums tracking-wider text-white">
                  {studentCode}
                </p>
              </div>
            </div>

            {/* ID Card Main Body */}
            <div className="p-5 sm:p-6 flex flex-col lg:flex-row items-center lg:items-stretch justify-between gap-6">
              {/* Left + Center: Portrait Photo + Student Information */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 flex-1 w-full min-w-0">
                {/* Student ID Portrait */}
                <div className="shrink-0 flex flex-col items-center gap-2">
                  <div className="relative w-28 h-34 sm:w-32 sm:h-40 rounded-2xl overflow-hidden border-2 border-white shadow-md bg-gradient-to-br from-slate-100 via-blue-50 to-slate-200 flex items-center justify-center">
                    {portraitSrc ? (
                      <img
                        src={portraitSrc}
                        alt={`${studentName} ID Portrait`}
                        referrerPolicy="no-referrer"
                        onError={() => setPortraitLoadFailed(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-600 select-none">
                        <UserRound className="w-10 h-10 text-slate-500 mb-1" />
                        <span className="text-sm font-extrabold tracking-wider text-slate-700">
                          {studentInitials}
                        </span>
                      </div>
                    )}
                  </div>

                  <input
                    ref={idPhotoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleIdPhotoSelected}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={uploadingPhoto}
                    onClick={() => idPhotoInputRef.current?.click()}
                    className="px-2.5 py-1.5 min-h-[32px] text-[11px] font-semibold text-slate-800 bg-white/80 hover:bg-white border border-white rounded-lg transition inline-flex items-center gap-1 shadow-2xs cursor-pointer disabled:opacity-60"
                  >
                    <Camera className="w-3 h-3 text-blue-600" />
                    <span>{uploadingPhoto ? 'Saving...' : portraitSrc ? 'Update Photo' : 'Add Photo'}</span>
                  </button>
                </div>

                {/* Student Information Details */}
                <div className="flex-1 w-full min-w-0 text-center sm:text-left space-y-3">
                  <div className="pb-2.5 border-b border-slate-900/10">
                    <p className="text-xs font-bold text-blue-700">Student Holder</p>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
                      {studentName}
                    </h2>
                  </div>

                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                    <div className="min-w-0">
                      <dt className="text-[11px] font-semibold text-slate-500">Student ID</dt>
                      <dd className="font-mono font-bold tabular-nums text-slate-900 mt-0.5">
                        {studentCode}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[11px] font-semibold text-slate-500">Department</dt>
                      <dd className="font-bold text-slate-900 mt-0.5 truncate">{department}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[11px] font-semibold text-slate-500">Campus Email</dt>
                      <dd className="font-medium text-slate-800 mt-0.5 truncate">
                        {user?.email || 'student@attendly.edu'}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[11px] font-semibold text-slate-500">Attendance Status</dt>
                      <dd className="font-semibold text-emerald-700 font-mono tabular-nums mt-0.5">
                        {attendedCourseIds.size}/{courses.length} subjects scanned
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Right: QR Verification Block */}
              <div className="bg-white/95 p-3 sm:p-3.5 rounded-2xl border border-white shadow-md shrink-0 flex flex-col items-center justify-center self-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR Code for ${studentName}`}
                    className="w-36 h-36 sm:w-40 sm:h-40 rounded-lg"
                  />
                ) : (
                  <div className="w-36 h-36 sm:w-40 sm:h-40 flex items-center justify-center text-xs text-slate-500">
                    Generating QR...
                  </div>
                )}
                <span className="text-[11px] font-mono font-bold tabular-nums text-slate-700 mt-1.5">
                  {studentCode}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Responsive Tab Bar */}
        <div className="flex items-center gap-1 p-1 bg-white/45 backdrop-blur-xl rounded-xl border border-white/60 overflow-x-auto no-scrollbar max-w-full w-fit">
          {(
            [
              { id: 'calendar', label: 'Schedule Calendar' },
              { id: 'qrpass', label: 'My Student QR' },
              { id: 'announcements', label: 'Announcements' },
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

        {/* WEEKLY SCHEDULE CALENDAR */}
        {activeTab === 'calendar' && (
          <section className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 p-4 sm:p-6 shadow-lg shadow-blue-950/5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/40">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-blue-600" />
                  <span>Weekly Schedule Calendar</span>
                </h3>
                <p className="text-xs text-slate-600 font-medium">
                  Checkmarks appear automatically under scanned subjects · Numbers show unread professor announcements
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-700 font-semibold shrink-0">
                {courses.length} enrolled subjects
              </span>
            </div>

            {/* Day Filter Bar (handy on mobile & tablet) */}
            {courses.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 xl:hidden">
                <button
                  type="button"
                  onClick={() => setSelectedDayFilter('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition cursor-pointer whitespace-nowrap shrink-0 ${
                    selectedDayFilter === 'all'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white/70 text-slate-800 border-white'
                  }`}
                >
                  Full Week
                </button>
                {WEEK_DAYS.map((d) => (
                  <button
                    key={d.short}
                    type="button"
                    onClick={() => setSelectedDayFilter(d.short)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition cursor-pointer whitespace-nowrap shrink-0 ${
                      selectedDayFilter === d.short
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white/70 text-slate-800 border-white'
                    }`}
                  >
                    {d.short}
                  </button>
                ))}
              </div>
            )}

            {courses.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <p className="text-sm font-semibold text-slate-700">
                  Your schedule calendar is currently empty.
                </p>
                <button
                  onClick={handleSeed}
                  disabled={seeding}
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
                >
                  {seeding ? 'Loading...' : 'Load Sample Student Schedule'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {visibleWeekDays.map((day) => {
                  const isToday = day.short === todayShort;
                  const dayCourses = courses.filter((c) =>
                    (c.scheduleDays || 'Mon · Wed · Fri')
                      .toLowerCase()
                      .includes(day.short.toLowerCase())
                  );

                  return (
                    <div
                      key={day.short}
                      className={`rounded-2xl border p-3.5 space-y-3 ${
                        isToday
                          ? 'bg-white/70 border-blue-400/70 shadow-md'
                          : 'bg-white/40 border-white/65'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-white/50">
                        <span className="text-xs font-extrabold text-slate-900">{day.label}</span>
                        {isToday && (
                          <span className="text-[11px] font-bold text-blue-700">Today</span>
                        )}
                      </div>

                      {dayCourses.length === 0 ? (
                        <p className="text-[11px] text-slate-500 py-4 text-center font-medium">
                          No scheduled classes
                        </p>
                      ) : (
                        <div className="space-y-2.5">
                          {dayCourses.map((course) => {
                            const isScanned = attendedCourseIds.has(course.id);
                            const unreadCount = unreadCountByCourse.get(course.id) || 0;

                            return (
                              <div
                                key={`${day.short}-${course.id}`}
                                className="bg-white/75 rounded-xl border border-white p-3 space-y-2 shadow-2xs"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-xs font-mono font-extrabold text-blue-700">
                                    {course.code}
                                  </span>

                                  {unreadCount > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleInspectSubjectAnnouncements(course.id)}
                                      title={`${unreadCount} unread professor announcement(s)`}
                                      className="min-w-5 h-5 px-1.5 rounded-full bg-rose-600 text-white text-[11px] font-mono font-bold tabular-nums flex items-center justify-center shadow-xs cursor-pointer hover:bg-rose-700"
                                    >
                                      {unreadCount}
                                    </button>
                                  )}
                                </div>

                                <p className="text-xs font-bold text-slate-900 leading-snug">
                                  {course.title}
                                </p>

                                <div className="text-[11px] text-slate-600 space-y-0.5 font-medium">
                                  <p className="inline-flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                                    <span>
                                      {course.building} · {course.room}
                                    </span>
                                  </p>
                                  <p className="font-mono tabular-nums inline-flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                                    <span>
                                      {course.startTime} – {course.endTime}
                                    </span>
                                  </p>
                                </div>

                                <div className="pt-1.5 border-t border-slate-200/70 flex items-center justify-between">
                                  {isScanned ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span>QR Checked</span>
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-medium text-slate-500">
                                      Pending QR scan
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ANNOUNCEMENTS SECTION */}
        {(activeTab === 'announcements' || activeTab === 'calendar') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
            {/* Official Admin School Announcements */}
            <section className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 p-4 sm:p-6 shadow-lg shadow-blue-950/5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/40">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-blue-600" />
                    <span>Official School Activities</span>
                  </h3>
                  <p className="text-xs text-slate-600 font-medium">
                    Campus-wide announcements posted by Administration
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums font-bold text-slate-700">
                  {officialAnnouncements.length}
                </span>
              </div>

              {officialAnnouncements.length === 0 ? (
                <p className="text-xs text-slate-600 py-6 text-center font-medium">
                  No official school announcements posted yet.
                </p>
              ) : (
                <div className="divide-y divide-white/40">
                  {officialAnnouncements.map((ann) => (
                    <div key={ann.id} className="py-3.5 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900">{ann.title}</p>
                        <span className="text-[11px] font-mono tabular-nums text-slate-600 shrink-0">
                          {ann.activityDate || ''}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">{ann.message}</p>
                      <p className="text-[11px] text-slate-600 font-medium">
                        Posted by {ann.authorName} (Admin)
                      </p>
                      <AnnouncementPhotoGallery
                        photos={photosByAnnouncementId.get(ann.id) || []}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Professor Subject-Specific Announcements */}
            <section className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 p-4 sm:p-6 shadow-lg shadow-blue-950/5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/40">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Subject Announcements
                  </h3>
                  <p className="text-xs text-slate-600 font-medium">
                    Updates posted by professors per subject
                  </p>
                </div>
              </div>

              {courses.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  <button
                    onClick={() => setSelectedSubjectFilter('all')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition cursor-pointer whitespace-nowrap shrink-0 ${
                      selectedSubjectFilter === 'all'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white/70 text-slate-800 border-white hover:bg-white'
                    }`}
                  >
                    All Subjects
                  </button>
                  {courses.map((c) => {
                    const unread = unreadCountByCourse.get(c.id) || 0;
                    const active = selectedSubjectFilter === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedSubjectFilter(c.id);
                          onMarkSubjectRead(c.id);
                        }}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white/70 text-slate-800 border-white hover:bg-white'
                        }`}
                      >
                        <span>{c.code}</span>
                        {unread > 0 && (
                          <span className="min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-mono font-bold tabular-nums flex items-center justify-center">
                            {unread}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {visibleSubjectAnnouncements.length === 0 ? (
                <p className="text-xs text-slate-600 py-6 text-center font-medium">
                  No subject announcements posted yet.
                </p>
              ) : (
                <div className="divide-y divide-white/40">
                  {visibleSubjectAnnouncements.map((ann) => {
                    const isUnread = !readAnnouncementIds.includes(ann.id);
                    return (
                      <div key={ann.id} className="py-3.5 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-slate-900">
                            <span className="font-mono text-blue-700">{ann.courseCode}</span> · {ann.title}
                          </p>
                          {isUnread && (
                            <button
                              onClick={() => onMarkAnnouncementRead(ann.id)}
                              className="text-[11px] font-bold text-blue-700 hover:underline cursor-pointer shrink-0"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">{ann.message}</p>
                        <p className="text-[11px] text-slate-600 font-medium">
                          {ann.authorName} ·{' '}
                          <span className="font-mono tabular-nums">
                            {new Date(ann.createdAt).toLocaleDateString()}
                          </span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
};
