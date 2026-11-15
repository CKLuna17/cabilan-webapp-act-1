import React, { useState } from 'react';
import {
  CalendarClock,
  Users,
  Plus,
  Trash2,
  MapPin,
  Clock,
  Search,
  Sparkles,
  Play,
  Square,
  Megaphone,
  DoorOpen,
  BookOpenCheck,
  GraduationCap,
  ArrowUpRight,
  Menu,
  ImagePlus,
  AlertTriangle,
  X,
  CheckCircle2,
  FileWarning,
} from 'lucide-react';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  CourseRecord,
  ClassSessionRecord,
  AttendanceRecord,
  DirectoryEntry,
  AnnouncementRecord,
  AnnouncementPhotoRecord,
  UserRole,
} from '../../types/attendly';
import { DashboardTab } from '../Sidebar';
import { AttendlyLogo } from '../AttendlyLogo';
import { AnnouncementPhotoGallery } from '../AnnouncementPhotoGallery';
import { generateCheckInCode, seedCampusData } from '../../lib/attendlySeed';
import {
  MAX_ANNOUNCEMENT_PHOTOS,
  PendingAnnouncementPhoto,
  formatPhotoFileSize,
  processAnnouncementImageFile,
  revokePendingPhotoPreview,
} from '../../lib/imageUpload';

interface AdminDashboardProps {
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  onOpenMenu: () => void;
  onSwitchDashboard: (role: UserRole) => void;
  courses: CourseRecord[];
  sessions: ClassSessionRecord[];
  attendance: AttendanceRecord[];
  directory: DirectoryEntry[];
  announcements: AnnouncementRecord[];
  announcementPhotos: AnnouncementPhotoRecord[];
  onNotify: (msg: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  activeTab,
  setActiveTab,
  onOpenMenu,
  onSwitchDashboard,
  courses,
  sessions,
  directory,
  announcements,
  announcementPhotos,
  onNotify,
}) => {
  const { user, userProfile } = useAuth();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roomFilter, setRoomFilter] = useState('all');
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Course form state
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [instructorName, setInstructorName] = useState('');
  const [department, setDepartment] = useState('Computer Science');
  const [building, setBuilding] = useState('');
  const [room, setRoom] = useState('');
  const [scheduleDays, setScheduleDays] = useState('Mon · Wed · Fri');
  const [startTime, setStartTime] = useState('09:00 AM');
  const [endTime, setEndTime] = useState('10:15 AM');

  // Session form state
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [sessionStatus, setSessionStatus] = useState<'scheduled' | 'active'>('active');

  // Official announcement form state
  const [annTitle, setAnnTitle] = useState('');
  const [annDate, setAnnDate] = useState(new Date().toISOString().split('T')[0]);
  const [annMessage, setAnnMessage] = useState('');
  const [pendingPhotos, setPendingPhotos] = useState<PendingAnnouncementPhoto[]>([]);
  const [processingPhotos, setProcessingPhotos] = useState(false);
  const [postingAnn, setPostingAnn] = useState(false);

  const pendingPhotosRef = React.useRef<PendingAnnouncementPhoto[]>([]);
  pendingPhotosRef.current = pendingPhotos;

  React.useEffect(() => {
    return () => {
      pendingPhotosRef.current.forEach(revokePendingPhotoPreview);
    };
  }, []);

  const activeSessions = sessions.filter((s) => s.status === 'active');
  const officialAnnouncements = announcements.filter((a) => a.scope === 'official');

  const photosByAnnouncementId = React.useMemo(() => {
    const map = new Map<string, AnnouncementPhotoRecord[]>();
    for (const photo of announcementPhotos) {
      const existing = map.get(photo.announcementId) || [];
      existing.push(photo);
      map.set(photo.announcementId, existing);
    }
    return map;
  }, [announcementPhotos]);

  const tooManyPhotos = pendingPhotos.length > MAX_ANNOUNCEMENT_PHOTOS;
  const invalidPendingPhotos = pendingPhotos.filter((p) => p.error !== null);
  const hasPhotoBlockers = tooManyPhotos || invalidPendingPhotos.length > 0 || processingPhotos;

  const roomEntries = React.useMemo(() => {
    const map = new Map<
      string,
      {
        roomKey: string;
        room: string;
        building: string;
        activeSession?: ClassSessionRecord;
        courses: CourseRecord[];
      }
    >();

    for (const c of courses) {
      const key = `${c.building} · ${c.room}`;
      const existing = map.get(key) || {
        roomKey: key,
        room: c.room,
        building: c.building,
        courses: [],
      };
      existing.courses.push(c);
      map.set(key, existing);
    }

    for (const s of sessions) {
      const key = `${s.building} · ${s.room}`;
      const existing = map.get(key) || {
        roomKey: key,
        room: s.room,
        building: s.building,
        courses: [],
      };
      if (s.status === 'active' || !existing.activeSession) {
        existing.activeSession = s;
      }
      map.set(key, existing);
    }

    return Array.from(map.values());
  }, [courses, sessions]);

  const filteredRooms = roomEntries.filter((entry) => {
    if (roomFilter !== 'all' && entry.roomKey !== roomFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      entry.roomKey.toLowerCase().includes(q) ||
      (entry.activeSession?.professorName || '').toLowerCase().includes(q) ||
      entry.courses.some(
        (c) =>
          (c.instructorName || '').toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q)
      )
    );
  });

  const handleSeed = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      await seedCampusData(user.uid, userProfile?.displayName || 'Prof. Alex Rivera');
      onNotify('Campus schedule, rooms, and official announcements loaded');
    } finally {
      setSeeding(false);
    }
  };

  const handlePhotoFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    e.target.value = '';

    setProcessingPhotos(true);
    try {
      const baseIndex = pendingPhotos.length;
      const processed = await Promise.all(
        files.map((file, idx) => processAnnouncementImageFile(file, baseIndex + idx))
      );
      setPendingPhotos((prev) => [...prev, ...processed]);
    } finally {
      setProcessingPhotos(false);
    }
  };

  const handleRemovePendingPhoto = (photoId: string) => {
    setPendingPhotos((prev) => {
      const target = prev.find((p) => p.id === photoId);
      if (target) revokePendingPhotoPreview(target);
      return prev.filter((p) => p.id !== photoId);
    });
  };

  const handlePostOfficialAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !annTitle.trim() || !annMessage.trim()) return;
    if (hasPhotoBlockers) {
      onNotify('Resolve photo upload issues before publishing');
      return;
    }

    const validPhotos = pendingPhotos.filter(
      (p): p is PendingAnnouncementPhoto & { dataUrl: string } =>
        p.error === null && typeof p.dataUrl === 'string' && p.dataUrl.length > 0
    );

    if (validPhotos.length !== pendingPhotos.length || validPhotos.length > MAX_ANNOUNCEMENT_PHOTOS) {
      onNotify('Cannot proceed: invalid or excess pictures attached');
      return;
    }

    setPostingAnn(true);
    const annId = `ann_${Date.now()}`;
    const createdAt = new Date().toISOString();
    const newAnnouncement: AnnouncementRecord = {
      id: annId,
      title: annTitle.trim(),
      message: annMessage.trim(),
      scope: 'official',
      courseId: 'all',
      courseCode: 'CAMPUS',
      courseTitle: 'Official School Activity',
      activityDate: annDate,
      photoCount: validPhotos.length,
      authorId: user.uid,
      authorName: userProfile?.displayName || 'School Administration',
      authorRole: 'admin',
      campusScope: 'attendly',
      createdAt,
    };

    try {
      await setDoc(doc(db, 'announcements', annId), newAnnouncement);
    } catch (err) {
      setPostingAnn(false);
      handleFirestoreError(err, OperationType.CREATE, `announcements/${annId}`);
      return;
    }

    if (validPhotos.length > 0) {
      try {
        await Promise.all(
          validPhotos.map((photo, idx) => {
            const photoDoc: AnnouncementPhotoRecord = {
              id: photo.id,
              announcementId: annId,
              name: photo.name.slice(0, 256),
              mimeType: photo.mimeType.slice(0, 64),
              sizeBytes: photo.sizeBytes,
              orderIndex: idx,
              dataUrl: photo.dataUrl,
              authorId: user.uid,
              campusScope: 'attendly',
              createdAt,
            };
            return setDoc(doc(db, 'announcementPhotos', photo.id), photoDoc);
          })
        );
      } catch (err) {
        setPostingAnn(false);
        handleFirestoreError(err, OperationType.CREATE, 'announcementPhotos');
        return;
      }
    }

    pendingPhotos.forEach(revokePendingPhotoPreview);
    setPendingPhotos([]);
    setAnnTitle('');
    setAnnMessage('');
    setPostingAnn(false);
    onNotify(
      validPhotos.length > 0
        ? `Official school announcement published with ${validPhotos.length} photo(s)`
        : 'Official school announcement published'
    );
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      const attachedPhotos = photosByAnnouncementId.get(id) || [];
      await Promise.all(
        attachedPhotos.map((photo) => deleteDoc(doc(db, 'announcementPhotos', photo.id)))
      );
      await deleteDoc(doc(db, 'announcements', id));
      onNotify('Announcement removed');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `announcements/${id}`);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !code.trim() || !title.trim() || !building.trim() || !room.trim()) return;
    const courseId = `course_${Date.now()}`;
    const newCourse: CourseRecord = {
      id: courseId,
      code: code.trim().toUpperCase(),
      title: title.trim(),
      department: department.trim() || 'General Studies',
      instructorId: user.uid,
      instructorName: instructorName.trim() || userProfile?.displayName || 'Faculty Member',
      room: room.trim(),
      building: building.trim(),
      scheduleDays: scheduleDays.trim(),
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      capacity: 45,
      enrolledCount: 0,
      status: 'active',
      campusScope: 'attendly',
      createdBy: user.uid,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'courses', courseId), newCourse);
      onNotify(`Course ${newCourse.code} assigned to ${newCourse.building} ${newCourse.room}`);
      setCode('');
      setTitle('');
      setInstructorName('');
      setBuilding('');
      setRoom('');
      setShowCourseForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `courses/${courseId}`);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const targetCourse = courses.find((c) => c.id === selectedCourseId) || courses[0];
    if (!targetCourse) {
      onNotify('Create a course before scheduling a session');
      return;
    }

    const sessionId = `sess_${Date.now()}`;
    const newSession: ClassSessionRecord = {
      id: sessionId,
      courseId: targetCourse.id,
      courseCode: targetCourse.code,
      courseTitle: targetCourse.title,
      professorId: targetCourse.instructorId || user.uid,
      professorName: targetCourse.instructorName || 'Faculty',
      room: targetCourse.room,
      building: targetCourse.building,
      sessionDate,
      startTime: targetCourse.startTime,
      endTime: targetCourse.endTime,
      checkInCode: generateCheckInCode(),
      status: sessionStatus,
      campusScope: 'attendly',
      createdBy: user.uid,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'sessions', sessionId), newSession);
      onNotify(`Session scheduled in ${newSession.room} with ${newSession.professorName}`);
      setShowSessionForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `sessions/${sessionId}`);
    }
  };

  const handleUpdateSessionStatus = async (
    session: ClassSessionRecord,
    nextStatus: 'scheduled' | 'active' | 'completed'
  ) => {
    try {
      await updateDoc(doc(db, 'sessions', session.id), { status: nextStatus });
      onNotify(`${session.courseCode} marked ${nextStatus}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `sessions/${session.id}`);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    try {
      await deleteDoc(doc(db, 'courses', courseId));
      onNotify('Course removed');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `courses/${courseId}`);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteDoc(doc(db, 'sessions', sessionId));
      onNotify('Session removed');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `sessions/${sessionId}`);
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
              Admin Dashboard
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-700 font-medium truncate">
              Attendly · {userProfile?.displayName || 'Administrator'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {courses.length === 0 && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="px-3 py-2 min-h-[40px] text-xs font-semibold text-slate-800 bg-white/65 hover:bg-white/90 border border-white/75 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">{seeding ? 'Loading...' : 'Load Sample Campus'}</span>
              <span className="sm:hidden">{seeding ? '...' : 'Sample'}</span>
            </button>
          )}
          <button
            onClick={() => {
              setShowCourseForm(!showCourseForm);
              setShowSessionForm(false);
            }}
            className="px-3.5 sm:px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-blue-600/25 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Assign Course & Room</span>
            <span className="sm:hidden">Add Room</span>
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-5 sm:space-y-6 flex-1">
        {/* Direct Portal Access Banner for Admin */}
        <section className="bg-white/55 backdrop-blur-2xl rounded-2xl border border-white/70 p-4 sm:p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">Portal Access Control</h2>
            <p className="text-xs text-slate-700 mt-0.5 font-medium">
              Directly open and inspect the Professor or Student dashboard views
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => onSwitchDashboard('professor')}
              className="px-4 py-2.5 min-h-[44px] text-xs font-semibold text-slate-900 bg-white/80 hover:bg-white border border-white rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer whitespace-nowrap"
            >
              <BookOpenCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Open Professor Dashboard</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            </button>
            <button
              onClick={() => onSwitchDashboard('student')}
              className="px-4 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition flex items-center justify-center gap-2 shadow-md cursor-pointer whitespace-nowrap"
            >
              <GraduationCap className="w-4 h-4 text-blue-300 shrink-0" />
              <span>Open Student Dashboard</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            </button>
          </div>
        </section>

        {/* KPI Metrics Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white/50 backdrop-blur-2xl p-3.5 sm:p-4 rounded-2xl border border-white/60 shadow-lg shadow-blue-950/5 flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50/85 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
              <DoorOpen className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs font-semibold text-slate-600 truncate">Tracked Rooms</p>
              <p className="text-lg sm:text-xl font-extrabold text-slate-900 font-mono tabular-nums">
                {roomEntries.length}
              </p>
            </div>
          </div>

          <div className="bg-white/50 backdrop-blur-2xl p-3.5 sm:p-4 rounded-2xl border border-white/60 shadow-lg shadow-blue-950/5 flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50/85 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
              <CalendarClock className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs font-semibold text-slate-600 truncate">Active Sessions</p>
              <p className="text-lg sm:text-xl font-extrabold text-slate-900 font-mono tabular-nums">
                {activeSessions.length}
              </p>
            </div>
          </div>

          <div className="bg-white/50 backdrop-blur-2xl p-3.5 sm:p-4 rounded-2xl border border-white/60 shadow-lg shadow-blue-950/5 flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50/85 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
              <Megaphone className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs font-semibold text-slate-600 truncate">Official Notices</p>
              <p className="text-lg sm:text-xl font-extrabold text-slate-900 font-mono tabular-nums">
                {officialAnnouncements.length}
              </p>
            </div>
          </div>

          <div className="bg-white/50 backdrop-blur-2xl p-3.5 sm:p-4 rounded-2xl border border-white/60 shadow-lg shadow-blue-950/5 flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100/90 text-slate-700 border border-white flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs font-semibold text-slate-600 truncate">Campus Roster</p>
              <p className="text-lg sm:text-xl font-extrabold text-slate-900 font-mono tabular-nums">
                {directory.length}
              </p>
            </div>
          </div>
        </div>

        {/* Inline Course & Room Assignment Form */}
        {showCourseForm && (
          <form
            onSubmit={handleCreateCourse}
            className="bg-white/55 backdrop-blur-2xl rounded-2xl border border-white/70 p-4 sm:p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/40 pb-3">
              <h2 className="text-sm font-extrabold text-slate-900">Assign Course, Professor & Room</h2>
              <button
                type="button"
                onClick={() => setShowCourseForm(false)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Code (e.g. CS 201)"
                className="px-3.5 py-2.5 min-h-[44px] text-sm bg-white/75 border border-white rounded-xl focus:outline-none"
              />
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Course Title"
                className="px-3.5 py-2.5 min-h-[44px] text-sm bg-white/75 border border-white rounded-xl focus:outline-none lg:col-span-2"
              />
              <input
                type="text"
                required
                value={instructorName}
                onChange={(e) => setInstructorName(e.target.value)}
                placeholder="Assigned Professor Name"
                className="px-3.5 py-2.5 min-h-[44px] text-sm bg-white/75 border border-white rounded-xl focus:outline-none"
              />
              <input
                type="text"
                required
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                placeholder="Building (e.g. Turing Hall)"
                className="px-3.5 py-2.5 min-h-[44px] text-sm bg-white/75 border border-white rounded-xl focus:outline-none"
              />
              <input
                type="text"
                required
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="Room (e.g. Room 304)"
                className="px-3.5 py-2.5 min-h-[44px] text-sm bg-white/75 border border-white rounded-xl focus:outline-none"
              />
              <input
                type="text"
                value={scheduleDays}
                onChange={(e) => setScheduleDays(e.target.value)}
                placeholder="Days (Mon · Wed · Fri)"
                className="px-3.5 py-2.5 min-h-[44px] text-sm bg-white/75 border border-white rounded-xl focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  placeholder="09:00 AM"
                  className="px-3 py-2.5 min-h-[44px] text-sm bg-white/75 border border-white rounded-xl focus:outline-none"
                />
                <input
                  type="text"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder="10:15 AM"
                  className="px-3 py-2.5 min-h-[44px] text-sm bg-white/75 border border-white rounded-xl focus:outline-none"
                />
              </div>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Department"
                className="px-3.5 py-2.5 min-h-[44px] text-sm bg-white/75 border border-white rounded-xl focus:outline-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/25 cursor-pointer"
              >
                Save Course & Room Assignment
              </button>
            </div>
          </form>
        )}

        {/* Inline Session Form */}
        {showSessionForm && (
          <form
            onSubmit={handleCreateSession}
            className="bg-white/55 backdrop-blur-2xl rounded-2xl border border-white/70 p-4 sm:p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/40 pb-3">
              <h2 className="text-sm font-extrabold text-slate-900">Schedule Room Session</h2>
              <button
                type="button"
                onClick={() => setShowSessionForm(false)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={selectedCourseId || courses[0]?.id || ''}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="px-3.5 py-2.5 min-h-[44px] text-sm bg-white/80 border border-white rounded-xl focus:outline-none"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.room} ({c.instructorName})
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="px-3.5 py-2.5 min-h-[44px] text-sm bg-white/80 border border-white rounded-xl focus:outline-none"
              />
              <select
                value={sessionStatus}
                onChange={(e) => setSessionStatus(e.target.value as 'scheduled' | 'active')}
                className="px-3.5 py-2.5 min-h-[44px] text-sm bg-white/80 border border-white rounded-xl focus:outline-none"
              >
                <option value="active">Active Now</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
              >
                Publish Session
              </button>
            </div>
          </form>
        )}

        {/* Responsive Section Tabs & Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-white/45 backdrop-blur-xl rounded-xl border border-white/60 overflow-x-auto no-scrollbar max-w-full">
            {(
              [
                { id: 'overview', label: 'Overview' },
                { id: 'rooms', label: 'Room Usage' },
                { id: 'announcements', label: 'Official Announcements' },
                { id: 'courses', label: 'Courses & Sessions' },
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

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {courses.length > 0 && (
              <button
                onClick={() => {
                  setShowSessionForm(!showSessionForm);
                  setShowCourseForm(false);
                }}
                className="px-3.5 py-2 min-h-[40px] text-xs font-semibold text-slate-800 bg-white/65 hover:bg-white/90 border border-white/75 rounded-xl transition cursor-pointer whitespace-nowrap"
              >
                + Schedule Session
              </button>
            )}
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search room or professor..."
                className="pl-8 pr-3 py-2 min-h-[40px] text-xs bg-white/65 border border-white/75 rounded-xl focus:outline-none focus:bg-white/95 w-full sm:w-52 text-slate-900 placeholder-slate-500"
              />
            </div>
          </div>
        </div>

        {/* ROOM USAGE */}
        {(activeTab === 'overview' || activeTab === 'rooms') && (
          <section className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 p-4 sm:p-6 shadow-lg shadow-blue-950/5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/40">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Room Occupancy & Professor Lookup
                </h2>
                <p className="text-xs text-slate-600 font-medium">
                  Inspect any campus room to see which professor and class are currently using it
                </p>
              </div>
              <select
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="px-3 py-2 min-h-[40px] text-xs font-semibold bg-white/75 border border-white rounded-xl focus:outline-none text-slate-800 w-full sm:w-auto"
              >
                <option value="all">All Rooms ({roomEntries.length})</option>
                {roomEntries.map((r) => (
                  <option key={r.roomKey} value={r.roomKey}>
                    {r.roomKey}
                  </option>
                ))}
              </select>
            </div>

            {filteredRooms.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <p className="text-sm font-semibold text-slate-700">
                  No rooms or professors scheduled yet.
                </p>
                <button
                  onClick={handleSeed}
                  disabled={seeding}
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
                >
                  {seeding ? 'Populating...' : 'Populate Sample Campus Schedule'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {filteredRooms.map((entry) => {
                  const activeSess = entry.activeSession;
                  const primaryCourse = entry.courses[0];
                  const professorName =
                    activeSess?.professorName || primaryCourse?.instructorName || 'Unassigned';
                  const isLive = activeSess?.status === 'active';

                  return (
                    <div
                      key={entry.roomKey}
                      className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/75 p-4 flex flex-col justify-between gap-3 shadow-xs"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-extrabold text-slate-900 inline-flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                            {entry.room}
                          </span>
                          <span
                            className={`text-xs font-bold ${
                              isLive ? 'text-emerald-700' : 'text-slate-600'
                            }`}
                          >
                            {isLive ? 'In Use Now' : activeSess?.status || 'Scheduled'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium mt-0.5">{entry.building}</p>
                      </div>

                      <div className="pt-3 border-t border-white/60 space-y-1 text-xs">
                        <p className="text-slate-600 font-medium">
                          Professor:{' '}
                          <span className="font-bold text-slate-900">{professorName}</span>
                        </p>
                        <p className="text-slate-700 font-medium">
                          Subject:{' '}
                          <span className="font-mono font-bold text-blue-700">
                            {activeSess?.courseCode || primaryCourse?.code}
                          </span>{' '}
                          · {activeSess?.courseTitle || primaryCourse?.title}
                        </p>
                        <p className="text-slate-600 font-mono tabular-nums inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          {activeSess?.startTime || primaryCourse?.startTime} –{' '}
                          {activeSess?.endTime || primaryCourse?.endTime}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* OFFICIAL ANNOUNCEMENTS */}
        {(activeTab === 'overview' || activeTab === 'announcements') && (
          <section className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 p-4 sm:p-6 shadow-lg shadow-blue-950/5 space-y-5">
            <div className="pb-3 border-b border-white/40">
              <h2 className="text-base font-extrabold text-slate-900">
                Post Official School Announcement
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                Published announcements appear on all Student and Professor portals for official school activities
              </p>
            </div>

            <form onSubmit={handlePostOfficialAnnouncement} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="Announcement Title (e.g. Campus Career Fair)"
                  className="sm:col-span-2 px-3.5 py-2.5 min-h-[44px] text-sm bg-white/75 border border-white rounded-xl focus:outline-none text-slate-900"
                />
                <input
                  type="date"
                  value={annDate}
                  onChange={(e) => setAnnDate(e.target.value)}
                  className="px-3.5 py-2.5 min-h-[44px] text-sm bg-white/75 border border-white rounded-xl focus:outline-none text-slate-900"
                />
              </div>
              <textarea
                required
                rows={3}
                value={annMessage}
                onChange={(e) => setAnnMessage(e.target.value)}
                placeholder="Write details about the official school activity, venue, and schedule..."
                className="w-full px-3.5 py-2.5 text-sm bg-white/75 border border-white rounded-xl focus:outline-none text-slate-900"
              />

              {/* Photo Attachment Bar & Validation */}
              <div className="bg-white/45 rounded-xl border border-white/70 p-3.5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-900">
                      Attach Activity Pictures ({pendingPhotos.length}/{MAX_ANNOUNCEMENT_PHOTOS})
                    </p>
                    <p className="text-[11px] text-slate-600 font-medium">
                      Images only · Up to 4 pictures · Quality 500 KB minimum to 3 MB maximum
                    </p>
                  </div>
                  <div className="shrink-0">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoFilesSelected}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={pendingPhotos.length >= MAX_ANNOUNCEMENT_PHOTOS || processingPhotos}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full sm:w-auto px-3.5 py-2 min-h-[40px] text-xs font-semibold text-slate-900 bg-white/85 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed border border-white rounded-xl transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <ImagePlus className="w-4 h-4 text-blue-600" />
                      <span>
                        {processingPhotos
                          ? 'Checking images...'
                          : `Upload Images (${Math.min(pendingPhotos.length, MAX_ANNOUNCEMENT_PHOTOS)}/${MAX_ANNOUNCEMENT_PHOTOS})`}
                      </span>
                    </button>
                  </div>
                </div>

                {(tooManyPhotos || invalidPendingPhotos.length > 0) && (
                  <div
                    role="alert"
                    className="bg-rose-50/90 border border-rose-200 rounded-xl px-3.5 py-2.5 flex items-start gap-2 text-xs text-rose-800 font-medium"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-bold text-rose-900">
                        Cannot proceed to publish announcement
                      </p>
                      {tooManyPhotos && (
                        <p>
                          You attached {pendingPhotos.length} pictures. Remove{' '}
                          {pendingPhotos.length - MAX_ANNOUNCEMENT_PHOTOS} picture(s) to meet the
                          4-picture limit.
                        </p>
                      )}
                      {invalidPendingPhotos.length > 0 && (
                        <p>
                          {invalidPendingPhotos.length} attached file(s) failed the required image
                          quality check (Images only, 500 KB min – 3 MB max). Remove highlighted
                          item(s) to continue.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {pendingPhotos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    {pendingPhotos.map((photo, index) => {
                      const exceedsLimit = index >= MAX_ANNOUNCEMENT_PHOTOS;
                      const itemError =
                        photo.error ||
                        (exceedsLimit ? 'Exceeds maximum of 4 pictures per announcement.' : null);

                      return (
                        <div
                          key={photo.id}
                          className={`rounded-xl border p-2 flex flex-col gap-1.5 relative transition ${
                            itemError
                              ? 'bg-rose-50/90 border-rose-300'
                              : 'bg-white/80 border-white shadow-2xs'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleRemovePendingPhoto(photo.id)}
                            aria-label={`Remove ${photo.name}`}
                            className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center shadow-xs cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>

                          <div className="aspect-4/3 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center">
                            {photo.previewUrl ? (
                              <img
                                src={photo.previewUrl}
                                alt={photo.name}
                                className={`w-full h-full object-cover ${
                                  itemError ? 'opacity-65' : ''
                                }`}
                              />
                            ) : (
                              <FileWarning className="w-6 h-6 text-rose-500" />
                            )}
                          </div>

                          <div className="min-w-0 space-y-0.5">
                            <p className="text-[11px] font-bold text-slate-900 truncate">
                              {photo.name}
                            </p>
                            <p className="text-[10px] font-mono tabular-nums text-slate-600">
                              {formatPhotoFileSize(photo.sizeBytes)}
                            </p>
                            {itemError ? (
                              <p className="text-[10px] font-semibold text-rose-700 leading-tight">
                                {itemError}
                              </p>
                            ) : (
                              <p className="text-[10px] font-semibold text-emerald-700 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                <span>Ready</span>
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={postingAnn || hasPhotoBlockers}
                  className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:shadow-none disabled:cursor-not-allowed rounded-xl shadow-md shadow-blue-600/25 flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  <span>{postingAnn ? 'Publishing...' : 'Publish Official Announcement'}</span>
                </button>
              </div>
            </form>

            <div className="pt-3 border-t border-white/40 space-y-2">
              <h3 className="text-xs font-bold text-slate-700">
                Published Official Announcements ({officialAnnouncements.length})
              </h3>
              {officialAnnouncements.length === 0 ? (
                <p className="text-xs text-slate-600 py-4 text-center font-medium">
                  No official announcements posted yet.
                </p>
              ) : (
                <div className="divide-y divide-white/40">
                  {officialAnnouncements.map((ann) => (
                    <div key={ann.id} className="py-3.5 flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900">{ann.title}</p>
                        <p className="text-xs text-slate-700 leading-relaxed">{ann.message}</p>
                        <p className="text-[11px] text-slate-600 font-medium">
                          {ann.authorName} · Activity Date:{' '}
                          <span className="font-mono tabular-nums">{ann.activityDate || 'Upcoming'}</span>
                        </p>
                        <AnnouncementPhotoGallery
                          photos={photosByAnnouncementId.get(ann.id) || []}
                        />
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

        {/* Courses & Sessions List */}
        {(activeTab === 'overview' || activeTab === 'courses') && (
          <section className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 p-4 sm:p-6 shadow-lg shadow-blue-950/5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/40">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Courses & Active Sessions</h2>
                <p className="text-xs text-slate-600 font-medium">
                  Manage campus subjects, instructors, and check-in windows
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-700 font-semibold">
                {courses.length} courses · {sessions.length} sessions
              </span>
            </div>

            {courses.length === 0 && sessions.length === 0 ? (
              <p className="text-xs text-slate-600 py-6 text-center font-medium">
                No courses or sessions found.
              </p>
            ) : (
              <div className="divide-y divide-white/40">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-slate-900">
                        <span className="font-mono text-blue-700">{sess.courseCode}</span>
                        <span aria-hidden="true">·</span>
                        <span>{sess.courseTitle}</span>
                      </div>
                      <p className="text-xs text-slate-700 mt-1 font-medium">
                        {sess.professorName || 'Faculty'} · {sess.building} {sess.room} ·{' '}
                        <span className="font-mono tabular-nums">
                          {sess.sessionDate} ({sess.startTime} – {sess.endTime})
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span
                        className={`text-xs font-semibold capitalize ${
                          sess.status === 'active'
                            ? 'text-emerald-700'
                            : sess.status === 'scheduled'
                            ? 'text-amber-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {sess.status}
                      </span>
                      {sess.status !== 'active' ? (
                        <button
                          onClick={() => handleUpdateSessionStatus(sess, 'active')}
                          className="px-3 py-1.5 text-xs font-semibold bg-white/80 hover:bg-white text-emerald-700 border border-white rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3 h-3" />
                          <span>Activate</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateSessionStatus(sess, 'completed')}
                          className="px-3 py-1.5 text-xs font-semibold bg-white/80 hover:bg-white text-slate-700 border border-white rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Square className="w-3 h-3" />
                          <span>Close</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteSession(sess.id)}
                        className="p-2 text-slate-500 hover:text-rose-600 hover:bg-white/70 rounded-xl transition cursor-pointer"
                        title="Delete session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {courses.map((course) => (
                  <div
                    key={course.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">
                        <span className="font-mono text-blue-700">{course.code}</span> · {course.title}
                      </p>
                      <p className="text-slate-600 font-medium mt-0.5">
                        {course.instructorName} · {course.building} {course.room} ·{' '}
                        {course.scheduleDays} ({course.startTime} – {course.endTime})
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteCourse(course.id)}
                      className="p-2 text-slate-500 hover:text-rose-600 hover:bg-white/70 rounded-xl transition cursor-pointer shrink-0"
                      title="Delete course"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};
