import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Users,
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
  ImagePlus,
  AlertTriangle,
  X,
  CheckCircle2,
  FileWarning,
  Sun,
  Moon,
  LogOut,
  AlertCircle,
  UserPlus,
  Camera,
  Check,
  XCircle,
} from 'lucide-react';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  CourseRecord,
  ClassSessionRecord,
  AttendanceRecord,
  DirectoryEntry,
  AnnouncementRecord,
  AnnouncementPhotoRecord,
  AccountRequestRecord,
} from '../../types/attendly';
import { DashboardTab } from '../Sidebar';
import { AnnouncementPhotoGallery } from '../AnnouncementPhotoGallery';
import { deriveStudentCode, generateCheckInCode, seedCampusData } from '../../lib/attendlySeed';
import {
  MAX_ANNOUNCEMENT_PHOTOS,
  PendingAnnouncementPhoto,
  compressIdPortraitToDataUrl,
  formatPhotoFileSize,
  processAnnouncementImageFile,
  revokePendingPhotoPreview,
} from '../../lib/imageUpload';

interface AdminDashboardProps {
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  courses: CourseRecord[];
  sessions: ClassSessionRecord[];
  attendance: AttendanceRecord[];
  directory: DirectoryEntry[];
  accountRequests: AccountRequestRecord[];
  announcements: AnnouncementRecord[];
  announcementPhotos: AnnouncementPhotoRecord[];
  onNotify: (msg: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  activeTab,
  setActiveTab,
  courses,
  sessions,
  attendance,
  accountRequests,
  announcements,
  announcementPhotos,
  onNotify,
}) => {
  const { user, userProfile, signOutUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const accountPhotoInputRef = React.useRef<HTMLInputElement | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [headerSearchOpen, setHeaderSearchOpen] = useState(false);

  useEffect(() => {
    if (!headerSearchOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHeaderSearchOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [headerSearchOpen]);
  const [roomFilter, setRoomFilter] = useState('all');
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Admin Profile -> Account creation & ID-style review state
  const [showCreateAccountForm, setShowCreateAccountForm] = useState(false);
  const [newAccountRole, setNewAccountRole] = useState<'student' | 'professor'>('student');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountEmail, setNewAccountEmail] = useState('');
  const [newAccountDepartment, setNewAccountDepartment] = useState('BSIT · College of Computing');
  const [newAccountCode, setNewAccountCode] = useState('');
  const [newAccountPhoto, setNewAccountPhoto] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [uploadingAccountPhoto, setUploadingAccountPhoto] = useState(false);

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

  const photosByAnnouncementId = useMemo(() => {
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

  const roomEntries = useMemo(() => {
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

  const roomsInUseCount = useMemo(
    () => roomEntries.filter((r) => r.activeSession?.status === 'active').length,
    [roomEntries]
  );

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

  const lateScansCount = useMemo(
    () => attendance.filter((a) => a.status === 'late').length,
    [attendance]
  );

  const presentScansCount = useMemo(
    () => attendance.filter((a) => a.status === 'present' || a.status === 'late').length,
    [attendance]
  );

  const presentRatePct = useMemo(() => {
    if (attendance.length === 0) return 100;
    return Math.round((presentScansCount / attendance.length) * 100);
  }, [attendance.length, presentScansCount]);

  const lateRatePct = useMemo(() => {
    if (attendance.length === 0) return 0;
    return Math.round((lateScansCount / attendance.length) * 100);
  }, [attendance.length, lateScansCount]);

  const scheduledSessionsCount = useMemo(
    () => sessions.filter((s) => s.status === 'scheduled').length,
    [sessions]
  );

  const attentionItems = useMemo(() => {
    const items: {
      id: string;
      title: string;
      detail: string;
      tone: 'rose' | 'amber' | 'blue';
      targetTab: DashboardTab;
    }[] = [];

    for (const s of sessions) {
      if (s.status === 'scheduled') {
        items.push({
          id: `sess_${s.id}`,
          title: `${s.courseCode} awaits activation`,
          detail: `${s.room} · ${s.professorName || 'Faculty'} · starts ${s.startTime}`,
          tone: 'blue',
          targetTab: 'courses',
        });
      }
    }

    for (const r of attendance) {
      if (r.status === 'late' || r.status === 'absent') {
        items.push({
          id: `att_${r.id}`,
          title:
            r.status === 'absent'
              ? `Absent alert: ${r.studentName}`
              : `Late scan: ${r.studentName}`,
          detail: `${r.courseCode} · ${r.room} · ${new Date(r.checkedInAt).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          })}`,
          tone: r.status === 'absent' ? 'rose' : 'amber',
          targetTab: 'courses',
        });
      }
    }

    for (const entry of roomEntries) {
      const hasScans = attendance.some((a) => a.room === entry.room);
      if (entry.activeSession?.status === 'active' && !hasScans) {
        items.push({
          id: `room_${entry.roomKey}`,
          title: `${entry.room} has no scans yet`,
          detail: `${entry.activeSession.courseCode} · ${entry.activeSession.professorName}`,
          tone: 'rose',
          targetTab: 'rooms',
        });
      }
    }

    if (officialAnnouncements.length === 0 && courses.length > 0) {
      items.push({
        id: 'notice_none',
        title: 'No official notice posted',
        detail: 'Publish a campus-wide activity announcement',
        tone: 'amber',
        targetTab: 'announcements',
      });
    }

    return items;
  }, [sessions, attendance, roomEntries, officialAnnouncements.length, courses.length]);

  const currentTimeDisplay = new Date().toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  const adminName = userProfile?.displayName || 'Admin Office';
  const adminInitials = useMemo(() => {
    const parts = adminName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'AO';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [adminName]);

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
      category: 'official',
      courseId: 'all',
      courseCode: 'CAMPUS',
      courseTitle: 'Official School Activity',
      activityDate: annDate,
      photoCount: validPhotos.length,
      authorId: user.uid,
      authorName: adminName,
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
      instructorName: instructorName.trim() || adminName,
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

  const handleAccountPhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingAccountPhoto(true);
    try {
      const compressed = await compressIdPortraitToDataUrl(file);
      setNewAccountPhoto(compressed);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Unable to attach ID photo');
    } finally {
      setUploadingAccountPhoto(false);
    }
  };

  const handleCreateAccountRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newAccountName.trim() || !newAccountEmail.trim()) return;
    setCreatingAccount(true);
    const reqId = `acc_${Date.now()}`;
    const generatedCode =
      newAccountCode.trim() ||
      (newAccountRole === 'professor'
        ? `FAC-${deriveStudentCode(reqId).replace('STU-', '')}`
        : deriveStudentCode(reqId));

    const record: AccountRequestRecord = {
      id: reqId,
      fullName: newAccountName.trim(),
      email: newAccountEmail.trim(),
      role: newAccountRole,
      department:
        newAccountDepartment.trim() ||
        (newAccountRole === 'professor' ? 'College of Computing' : 'BSIT · 3-A'),
      studentCode: generatedCode,
      ...(newAccountPhoto ? { photoDataUrl: newAccountPhoto } : {}),
      status: 'pending',
      source: 'admin_created',
      campusScope: 'attendly',
      createdBy: user.uid,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'accountRequests', reqId), record);
      onNotify(`${newAccountRole === 'professor' ? 'Professor' : 'Student'} account queued for ID review`);
      setNewAccountName('');
      setNewAccountEmail('');
      setNewAccountCode('');
      setNewAccountPhoto('');
      setShowCreateAccountForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `accountRequests/${reqId}`);
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleReviewAccountRequest = async (
    req: AccountRequestRecord,
    decision: 'approved' | 'rejected'
  ) => {
    const reviewedAt = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'accountRequests', req.id), {
        status: decision,
        reviewedBy: adminName,
        reviewedAt,
      });

      const dirId = req.source === 'self_signup' ? req.createdBy : req.id;
      if (decision === 'approved') {
        await setDoc(
          doc(db, 'directory', dirId),
          {
            id: dirId,
            displayName: req.fullName,
            role: req.role,
            department: req.department || 'Computer Science',
            studentCode: req.studentCode || deriveStudentCode(dirId),
            campusScope: 'attendly',
            updatedAt: reviewedAt,
          },
          { merge: true }
        );
      } else {
        try {
          await deleteDoc(doc(db, 'directory', dirId));
        } catch {
          // ignore if not in directory yet
        }
      }

      onNotify(
        decision === 'approved'
          ? `Approved ${req.fullName} (${req.role})`
          : `Rejected ${req.fullName}`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `accountRequests/${req.id}`);
    }
  };

  const todayDisplay = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 xl:h-full overflow-y-auto subtle-scrollbar smooth-scroll smooth-resize">
      {/* Unified Top Header (Desktop + Tablet + Mobile) */}
      <header className="px-4 sm:px-6 xl:px-7 pt-[max(2.25rem,env(safe-area-inset-top))] sm:pt-9 xl:pt-5 pb-3 flex items-center justify-between gap-3 smooth-resize">
        <div className="hidden xl:block min-w-0">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Campus overview
          </h1>
          <p className="text-xs text-slate-500 dark:text-[#A6A0CE] font-medium mt-0.5 font-mono tabular-nums">
            {todayDisplay} · {currentTimeDisplay} · updates live
          </p>
        </div>

        <div className="flex xl:hidden items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            aria-label="Open profile"
            className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6B5BF7] to-[#5142E6] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-md shadow-[#5142E6]/25 cursor-pointer"
          >
            {adminInitials}
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500 dark:text-[#A6A0CE] truncate font-mono tabular-nums">
              {todayDisplay} · updates live
            </p>
            <h1 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
              {adminName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {courses.length === 0 && (
            <button
              type="button"
              onClick={handleSeed}
              disabled={seeding}
              className="hidden sm:flex px-3.5 py-2 min-h-[40px] text-xs font-bold text-[#5346E8] dark:text-[#BDB6FF] bg-white dark:bg-[#1B1738] border border-[#E7E3FA] dark:border-[#2C2654] rounded-full items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{seeding ? 'Loading...' : 'Load Sample Campus'}</span>
            </button>
          )}
          {searchQuery.trim() && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="px-3 py-2 min-h-[40px] rounded-full bg-[#ECE9FC] dark:bg-[#2A2454] text-[#5346E8] dark:text-[#BDB6FF] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <span className="max-w-[110px] sm:max-w-[140px] truncate">&ldquo;{searchQuery.trim()}&rdquo;</span>
              <X className="w-3.5 h-3.5 shrink-0" />
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
            onClick={() => setHeaderSearchOpen(true)}
            aria-label="Search campus rooms and professors"
            className={`w-10 h-10 rounded-full border flex items-center justify-center transition cursor-pointer ${
              headerSearchOpen || searchQuery.trim()
                ? 'bg-[#5346E8] text-white border-[#5346E8]'
                : 'bg-white dark:bg-[#1B1738] border-[#E7E3FA] dark:border-[#2C2654] text-slate-700 dark:text-white hover:border-[#6B5BF7]'
            }`}
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="px-4 sm:px-6 xl:px-7 pt-3 sm:pt-4 xl:pt-3 pb-28 xl:pb-8 max-w-[1400px] w-full mx-auto space-y-4 flex-1 smooth-resize">
        {/* 4 KPI Cards */}
        {activeTab !== 'profile' && (
          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5 smooth-resize">
            <div className="bg-white dark:bg-[#1B1738] rounded-2xl border border-[#E7E3FA] dark:border-[#2C2654] p-3.5 flex items-center gap-3 shadow-2xs">
              <div className="w-10 h-10 rounded-2xl bg-[#E6F7EE] dark:bg-[#143D2B] text-[#15803D] dark:text-[#7CE4AF] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-[#A6A0CE] truncate">
                  Present today
                </p>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                  {presentRatePct}%
                </p>
                <p className="text-[11px] text-slate-400 dark:text-[#8E88BE] truncate font-mono tabular-nums">
                  {presentScansCount} of {attendance.length} check-ins
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1B1738] rounded-2xl border border-[#E7E3FA] dark:border-[#2C2654] p-3.5 flex items-center gap-3 shadow-2xs">
              <div className="w-10 h-10 rounded-2xl bg-[#ECE9FC] dark:bg-[#272152] text-[#5346E8] dark:text-[#BDB6FF] flex items-center justify-center shrink-0">
                <DoorOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-[#A6A0CE] truncate">
                  Rooms in use
                </p>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                  {roomsInUseCount} of {roomEntries.length}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-[#8E88BE] truncate">
                  {Math.max(0, roomEntries.length - roomsInUseCount)} vacant right now
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1B1738] rounded-2xl border border-[#E7E3FA] dark:border-[#2C2654] p-3.5 flex items-center gap-3 shadow-2xs">
              <div className="w-10 h-10 rounded-2xl bg-[#FEF3C7] dark:bg-[#3B2C16] text-[#B45309] dark:text-[#F9C971] flex items-center justify-center shrink-0">
                <CalendarClock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-[#A6A0CE] truncate">
                  Active sessions
                </p>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                  {activeSessions.length} of {Math.max(sessions.length, activeSessions.length)}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-[#8E88BE] truncate">
                  {scheduledSessionsCount} scheduled · {officialAnnouncements.length} notices
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1B1738] rounded-2xl border border-[#E7E3FA] dark:border-[#2C2654] p-3.5 flex items-center gap-3 shadow-2xs">
              <div className="w-10 h-10 rounded-2xl bg-[#E6F1FD] dark:bg-[#192A4A] text-[#1D5DB0] dark:text-[#8EC2FF] flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-[#A6A0CE] truncate">
                  Late scans
                </p>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                  {lateScansCount}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-[#8E88BE] truncate font-mono tabular-nums">
                  {lateRatePct}% of check-ins
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Inline Course & Room Form */}
        {showCourseForm && (
          <form
            onSubmit={handleCreateCourse}
            className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-5 space-y-4 shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-[#EFEBFD] dark:border-[#2C2654] pb-3">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Assign Course, Professor & Room
              </h2>
              <button
                type="button"
                onClick={() => setShowCourseForm(false)}
                className="text-xs font-bold text-slate-500 dark:text-[#A6A0CE] cursor-pointer"
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
                className="px-3.5 py-2.5 min-h-[42px] text-xs bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl text-slate-900 dark:text-white"
              />
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Course Title"
                className="px-3.5 py-2.5 min-h-[42px] text-xs bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl lg:col-span-2 text-slate-900 dark:text-white"
              />
              <input
                type="text"
                required
                value={instructorName}
                onChange={(e) => setInstructorName(e.target.value)}
                placeholder="Assigned Professor Name"
                className="px-3.5 py-2.5 min-h-[42px] text-xs bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl text-slate-900 dark:text-white"
              />
              <input
                type="text"
                required
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                placeholder="Building (e.g. Turing Hall)"
                className="px-3.5 py-2.5 min-h-[42px] text-xs bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl text-slate-900 dark:text-white"
              />
              <input
                type="text"
                required
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="Room (e.g. Room 304)"
                className="px-3.5 py-2.5 min-h-[42px] text-xs bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl text-slate-900 dark:text-white"
              />
              <input
                type="text"
                value={scheduleDays}
                onChange={(e) => setScheduleDays(e.target.value)}
                placeholder="Days (Mon · Wed · Fri)"
                className="px-3.5 py-2.5 min-h-[42px] text-xs bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl text-slate-900 dark:text-white"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  placeholder="09:00 AM"
                  className="px-3 py-2.5 min-h-[42px] text-xs bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl text-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder="10:15 AM"
                  className="px-3 py-2.5 min-h-[42px] text-xs bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl text-slate-900 dark:text-white"
                />
              </div>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Department"
                className="px-3.5 py-2.5 min-h-[42px] text-xs bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-[#6B5BF7] to-[#5142E6] cursor-pointer"
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
            className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-5 space-y-4 shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-[#EFEBFD] dark:border-[#2C2654] pb-3">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Schedule Room Session
              </h2>
              <button
                type="button"
                onClick={() => setShowSessionForm(false)}
                className="text-xs font-bold text-slate-500 dark:text-[#A6A0CE] cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={selectedCourseId || courses[0]?.id || ''}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="px-3.5 py-2.5 min-h-[42px] text-xs bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl text-slate-900 dark:text-white"
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
                className="px-3.5 py-2.5 min-h-[42px] text-xs bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl text-slate-900 dark:text-white"
              />
              <select
                value={sessionStatus}
                onChange={(e) => setSessionStatus(e.target.value as 'scheduled' | 'active')}
                className="px-3.5 py-2.5 min-h-[42px] text-xs bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl text-slate-900 dark:text-white"
              >
                <option value="active">Active Now</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-[#6B5BF7] to-[#5142E6] cursor-pointer"
              >
                Publish Session
              </button>
            </div>
          </form>
        )}

        {/* Action Toolbar on Rooms & Courses sub-tabs (without duplicate nav pills or search bar) */}
        {(activeTab === 'rooms' || activeTab === 'courses') && (
          <div className="flex items-center justify-end gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setShowCourseForm((v) => !v);
                setShowSessionForm(false);
              }}
              className="px-3.5 py-2 min-h-[38px] rounded-full text-xs font-bold bg-white dark:bg-[#1B1738] border border-[#E7E3FA] dark:border-[#2C2654] text-slate-800 dark:text-white cursor-pointer whitespace-nowrap"
            >
              + Assign Course & Room
            </button>
            {courses.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowSessionForm((v) => !v);
                  setShowCourseForm(false);
                }}
                className="px-3.5 py-2 min-h-[38px] rounded-full text-xs font-bold bg-white dark:bg-[#1B1738] border border-[#E7E3FA] dark:border-[#2C2654] text-slate-800 dark:text-white cursor-pointer whitespace-nowrap"
              >
                + Schedule session
              </button>
            )}
          </div>
        )}

        {/* ================= OVERVIEW & ROOM MONITOR (Reference Image 2) ================= */}
        {(activeTab === 'overview' || activeTab === 'rooms') && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4 items-start smooth-resize">
            {/* Left Main Column */}
            <div className="space-y-4 min-w-0">
              {/* Room Monitor 3-Column Grid */}
              <section className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-4 sm:p-5 space-y-3 shadow-2xs smooth-resize">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Room monitor
                  </h2>
                  {activeTab === 'overview' ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab('rooms')}
                      className="text-xs font-bold text-[#5346E8] dark:text-[#A399FF] hover:underline cursor-pointer"
                    >
                      All {roomEntries.length} rooms
                    </button>
                  ) : (
                    <select
                      value={roomFilter}
                      onChange={(e) => setRoomFilter(e.target.value)}
                      className="px-3 py-2 text-xs font-bold bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-full text-slate-800 dark:text-white"
                    >
                      <option value="all">All {roomEntries.length} rooms</option>
                      {roomEntries.map((r) => (
                        <option key={r.roomKey} value={r.roomKey}>
                          {r.roomKey}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {filteredRooms.length === 0 ? (
                  <div className="py-10 text-center space-y-3">
                    <p className="text-sm font-bold text-slate-700 dark:text-white">
                      No rooms or professors scheduled yet.
                    </p>
                    <button
                      type="button"
                      onClick={handleSeed}
                      disabled={seeding}
                      className="px-5 py-2.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-[#6B5BF7] to-[#5142E6] cursor-pointer"
                    >
                      {seeding ? 'Populating...' : 'Populate Sample Campus Schedule'}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {filteredRooms.map((entry) => {
                      const activeSess = entry.activeSession;
                      const primaryCourse = entry.courses[0];
                      const professorName =
                        activeSess?.professorName || primaryCourse?.instructorName || 'Unassigned';
                      const isLive = activeSess?.status === 'active';
                      const shortRoom = entry.room.replace(/^Room\s+/i, '');

                      return (
                        <div
                          key={entry.roomKey}
                          className="p-4 rounded-2xl bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#EFEBFD] dark:border-[#322B61] flex flex-col justify-between gap-2.5"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono tabular-nums truncate">
                                {shortRoom}
                              </span>
                              <span className="text-[11px] text-slate-400 dark:text-[#8E88BE] truncate">
                                {entry.building}
                              </span>
                            </div>
                            <div className="mt-1.5">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  isLive
                                    ? 'bg-[#E6F7EE] dark:bg-[#143D2B] text-[#15803D] dark:text-[#7CE4AF]'
                                    : 'bg-[#E6F1FD] dark:bg-[#1C3258] text-[#1D5DB0] dark:text-[#8EC2FF]'
                                }`}
                              >
                                {isLive ? 'In use' : 'Vacant'}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-0.5 text-xs">
                            <p className="font-extrabold text-slate-900 dark:text-white truncate">
                              {isLive
                                ? activeSess?.courseTitle || primaryCourse?.title
                                : `Next: ${activeSess?.courseTitle || primaryCourse?.title || 'Open'}`}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-[#A6A0CE] truncate">
                              {isLive
                                ? professorName
                                : `Starts ${activeSess?.startTime || primaryCourse?.startTime || 'TBD'}`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Recent Scans Table */}
              {activeTab === 'overview' && (
                <section className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-5 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                      Recent scans
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('courses')}
                      className="text-xs font-bold text-[#5346E8] dark:text-[#A399FF] hover:underline cursor-pointer"
                    >
                      Open scan log
                    </button>
                  </div>

                  {attendance.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-[#A6A0CE] py-4 text-center">
                      No QR or manual scans recorded yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-[#EFEBFD] dark:border-[#2C2654] text-slate-400 dark:text-[#8E88BE] font-semibold">
                            <th className="py-2 pr-3">Time</th>
                            <th className="py-2 pr-3">Student</th>
                            <th className="py-2 pr-3">Subject</th>
                            <th className="py-2 pr-3">Room</th>
                            <th className="py-2 text-right">Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EFEBFD] dark:divide-[#2C2654]">
                          {attendance.slice(0, 6).map((rec) => (
                            <tr key={rec.id}>
                              <td className="py-2.5 pr-3 font-mono tabular-nums text-slate-500 dark:text-[#A6A0CE] whitespace-nowrap">
                                {new Date(rec.checkedInAt).toLocaleTimeString([], {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td className="py-2.5 pr-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                {rec.studentName}
                              </td>
                              <td className="py-2.5 pr-3 text-slate-600 dark:text-[#D1CCEE] whitespace-nowrap">
                                {rec.courseTitle || rec.courseCode}
                              </td>
                              <td className="py-2.5 pr-3 text-slate-500 dark:text-[#A6A0CE] whitespace-nowrap">
                                {rec.room}
                              </td>
                              <td className="py-2.5 text-right whitespace-nowrap">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${
                                    rec.status === 'present'
                                      ? 'bg-[#E6F7EE] dark:bg-[#143D2B] text-[#15803D] dark:text-[#7CE4AF]'
                                      : rec.status === 'late'
                                      ? 'bg-[#FEF3C7] dark:bg-[#3E2E16] text-[#B45309] dark:text-[#F8C871]'
                                      : 'bg-[#FEE2E2] dark:bg-rose-950/50 text-[#BE123C] dark:text-rose-300'
                                  }`}
                                >
                                  {rec.status === 'present'
                                    ? 'Verified'
                                    : rec.status === 'absent'
                                    ? 'Flagged'
                                    : rec.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
            </div>

            {/* Right Rail: Attendance by Subject + Needs Attention */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-5 items-start">
              {/* Attendance by Subject */}
              <section className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-5 space-y-3.5 shadow-2xs">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Attendance by subject
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-[#A6A0CE]">
                    Today, all subjects
                  </p>
                </div>

                {courses.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-[#A6A0CE] py-2">
                    No courses loaded yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {courses.map((c) => {
                      const scans = attendance.filter((a) => a.courseId === c.id).length;
                      const enrolled = c.enrolledCount ?? 0;
                      const pct = Math.min(
                        100,
                        enrolled > 0 ? Math.round((scans / enrolled) * 100) : scans > 0 ? 100 : 0
                      );
                      return (
                        <div key={c.id} className="grid grid-cols-[minmax(72px,96px)_1fr_36px] items-center gap-2.5 sm:gap-3">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {c.code}
                          </span>
                          <div className="h-2 rounded-full bg-[#EFEBFD] dark:bg-[#2A2454] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#6B5BF7] to-[#8C7DFF]"
                              style={{ width: `${Math.max(8, pct)}%` }}
                            />
                          </div>
                          <span className="text-xs font-extrabold font-mono tabular-nums text-right text-slate-900 dark:text-white">
                            {pct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Needs Attention Card */}
              <section className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Needs attention
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono tabular-nums ${
                      attentionItems.length > 0
                        ? 'bg-[#FEE2E2] dark:bg-rose-950/60 text-[#BE123C] dark:text-rose-300'
                        : 'bg-[#E6F7EE] dark:bg-[#143D2B] text-[#15803D] dark:text-[#7CE4AF]'
                    }`}
                  >
                    {attentionItems.length} open
                  </span>
                </div>

                {attentionItems.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-[#A6A0CE] py-2">
                    All rooms, sessions, and check-ins are running smoothly.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {attentionItems.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-2xl bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#EFEBFD] dark:border-[#322B61] flex items-center justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              item.tone === 'rose'
                                ? 'bg-[#FEE2E2] dark:bg-rose-950/60 text-[#BE123C] dark:text-rose-300'
                                : item.tone === 'amber'
                                ? 'bg-[#FEF3C7] dark:bg-[#3B2C16] text-[#B45309] dark:text-[#F9C971]'
                                : 'bg-[#E6F1FD] dark:bg-[#192A4A] text-[#1D5DB0] dark:text-[#8EC2FF]'
                            }`}
                          >
                            {item.tone === 'rose' ? (
                              <AlertCircle className="w-4 h-4" />
                            ) : item.tone === 'amber' ? (
                              <AlertTriangle className="w-4 h-4" />
                            ) : (
                              <DoorOpen className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                              {item.title}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-[#A6A0CE] truncate">
                              {item.detail}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab(item.targetTab)}
                          className="px-3 py-1.5 rounded-full bg-white dark:bg-[#1B1738] border border-[#E7E3FA] dark:border-[#322B61] text-xs font-bold text-slate-900 dark:text-white cursor-pointer shrink-0"
                        >
                          View
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {/* ================= OFFICIAL SCHOOL ANNOUNCEMENTS (With Strict Image Validation) ================= */}
        {activeTab === 'announcements' && (
          <section className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-5 sm:p-6 space-y-5 shadow-2xs">
            <div className="pb-3 border-b border-[#EFEBFD] dark:border-[#2C2654]">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Post Official School Announcement
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#A6A0CE]">
                Published announcements appear across all Student and Professor portals
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
                  className="sm:col-span-2 px-3.5 py-2.5 min-h-[44px] text-sm bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl focus:outline-none text-slate-900 dark:text-white"
                />
                <input
                  type="date"
                  value={annDate}
                  onChange={(e) => setAnnDate(e.target.value)}
                  className="px-3.5 py-2.5 min-h-[44px] text-sm bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl focus:outline-none text-slate-900 dark:text-white"
                />
              </div>
              <textarea
                required
                rows={3}
                value={annMessage}
                onChange={(e) => setAnnMessage(e.target.value)}
                placeholder="Write details about the official school activity, venue, and schedule..."
                className="w-full px-3.5 py-2.5 text-sm bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl focus:outline-none text-slate-900 dark:text-white"
              />

              {/* Photo Attachment Bar & Validation (Up to 4 images, 500 KB - 3 MB) */}
              <div className="bg-[#F7F6FE] dark:bg-[#241F4A] rounded-2xl border border-[#E7E3FA] dark:border-[#322B61] p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="space-y-0.5">
                    <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                      Attach Activity Pictures ({pendingPhotos.length}/{MAX_ANNOUNCEMENT_PHOTOS})
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-[#A6A0CE] font-medium">
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
                      className="w-full sm:w-auto px-4 py-2 min-h-[40px] text-xs font-bold text-slate-900 dark:text-white bg-white dark:bg-[#1B1738] hover:bg-[#ECE9FC] dark:hover:bg-[#2F285F] disabled:opacity-50 disabled:cursor-not-allowed border border-[#E7E3FA] dark:border-[#322B61] rounded-full transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ImagePlus className="w-4 h-4 text-[#5346E8] dark:text-[#A399FF]" />
                      <span>
                        {processingPhotos
                          ? 'Checking images...'
                          : `Upload Images (${Math.min(
                              pendingPhotos.length,
                              MAX_ANNOUNCEMENT_PHOTOS
                            )}/${MAX_ANNOUNCEMENT_PHOTOS})`}
                      </span>
                    </button>
                  </div>
                </div>

                {(tooManyPhotos || invalidPendingPhotos.length > 0) && (
                  <div
                    role="alert"
                    className="bg-[#FEE2E2] dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 rounded-xl px-3.5 py-2.5 flex items-start gap-2 text-xs text-[#BE123C] dark:text-rose-200 font-medium"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-bold">Cannot proceed to publish announcement</p>
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
                              ? 'bg-[#FEE2E2] dark:bg-rose-950/60 border-rose-300 dark:border-rose-700'
                              : 'bg-white dark:bg-[#1B1738] border-[#E7E3FA] dark:border-[#322B61]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleRemovePendingPhoto(photo.id)}
                            aria-label={`Remove ${photo.name}`}
                            className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>

                          <div className="aspect-4/3 rounded-lg overflow-hidden bg-slate-100 dark:bg-[#110E26] flex items-center justify-center">
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
                            <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                              {photo.name}
                            </p>
                            <p className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-[#A6A0CE]">
                              {formatPhotoFileSize(photo.sizeBytes)}
                            </p>
                            {itemError ? (
                              <p className="text-[10px] font-semibold text-[#BE123C] dark:text-rose-300 leading-tight">
                                {itemError}
                              </p>
                            ) : (
                              <p className="text-[10px] font-semibold text-[#15803D] dark:text-[#7CE4AF] inline-flex items-center gap-1">
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
                  className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] text-xs font-bold text-white bg-gradient-to-r from-[#6B5BF7] to-[#5142E6] hover:from-[#5E4DF0] hover:to-[#4638D6] disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed rounded-full shadow-md shadow-[#5142E6]/25 flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  <span>{postingAnn ? 'Publishing...' : 'Publish Official Announcement'}</span>
                </button>
              </div>
            </form>

            {/* Published Official Announcements */}
            <div className="pt-3 border-t border-[#EFEBFD] dark:border-[#2C2654] space-y-3">
              <h3 className="text-xs font-bold text-slate-500 dark:text-[#A6A0CE]">
                Published Official Announcements ({officialAnnouncements.length})
              </h3>
              {officialAnnouncements.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-[#A6A0CE] py-4 text-center">
                  No official announcements posted yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {officialAnnouncements.map((ann) => (
                    <div
                      key={ann.id}
                      className="p-4 rounded-2xl bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#EFEBFD] dark:border-[#322B61] flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {ann.title}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-[#C8C2EA] leading-relaxed">
                          {ann.message}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-[#A6A0CE] font-medium">
                          {ann.authorName} · Activity Date:{' '}
                          <span className="font-mono tabular-nums">
                            {ann.activityDate || 'Upcoming'}
                          </span>
                        </p>
                        <AnnouncementPhotoGallery
                          photos={photosByAnnouncementId.get(ann.id) || []}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteAnnouncement(ann.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 rounded-xl transition cursor-pointer shrink-0"
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

        {/* ================= COURSES & SESSIONS + FULL SCAN LOG ================= */}
        {activeTab === 'courses' && (
          <section className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-5 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EFEBFD] dark:border-[#2C2654]">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Courses & Active Sessions
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#A6A0CE]">
                  Manage campus subjects, instructors, and check-in windows
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-[#5346E8] dark:text-[#BDB6FF] font-bold">
                {courses.length} courses · {sessions.length} sessions
              </span>
            </div>

            {courses.length === 0 && sessions.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-[#A6A0CE] py-6 text-center">
                No courses or sessions found.
              </p>
            ) : (
              <div className="divide-y divide-[#EFEBFD] dark:divide-[#2C2654]">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-sm font-extrabold text-slate-900 dark:text-white">
                        <span className="font-mono text-[#5346E8] dark:text-[#A399FF]">
                          {sess.courseCode}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{sess.courseTitle}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-[#A6A0CE] mt-1 font-medium">
                        {sess.professorName || 'Faculty'} · {sess.building} {sess.room} ·{' '}
                        <span className="font-mono tabular-nums">
                          {sess.sessionDate} ({sess.startTime} – {sess.endTime})
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${
                          sess.status === 'active'
                            ? 'bg-[#E6F7EE] dark:bg-[#143D2B] text-[#15803D] dark:text-[#7CE4AF]'
                            : sess.status === 'scheduled'
                            ? 'bg-[#FEF3C7] dark:bg-[#3E2E16] text-[#B45309] dark:text-[#F8C871]'
                            : 'bg-[#F5F3FE] dark:bg-[#241F4A] text-slate-600 dark:text-[#A6A0CE]'
                        }`}
                      >
                        {sess.status}
                      </span>
                      {sess.status !== 'active' ? (
                        <button
                          type="button"
                          onClick={() => void handleUpdateSessionStatus(sess, 'active')}
                          className="px-3 py-1.5 text-xs font-bold bg-[#E6F7EE] dark:bg-[#143D2B] text-[#15803D] dark:text-[#7CE4AF] rounded-full flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3 h-3" />
                          <span>Activate</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleUpdateSessionStatus(sess, 'completed')}
                          className="px-3 py-1.5 text-xs font-bold bg-[#F5F3FE] dark:bg-[#241F4A] text-slate-700 dark:text-white rounded-full flex items-center gap-1 cursor-pointer"
                        >
                          <Square className="w-3 h-3" />
                          <span>Close</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDeleteSession(sess.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 rounded-xl cursor-pointer"
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
                      <p className="font-extrabold text-slate-900 dark:text-white">
                        <span className="font-mono text-[#5346E8] dark:text-[#A399FF]">
                          {course.code}
                        </span>{' '}
                        · {course.title}
                      </p>
                      <p className="text-slate-500 dark:text-[#A6A0CE] font-medium mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {course.instructorName} · {course.building} {course.room} ·{' '}
                        {course.scheduleDays} ({course.startTime} – {course.endTime})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteCourse(course.id)}
                      className="p-2 text-slate-400 hover:text-rose-500 rounded-xl cursor-pointer shrink-0"
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

        {/* ================= PROFILE TAB ================= */}
        {activeTab === 'profile' && (
          <div className="max-w-3xl mx-auto space-y-5">
            <input
              ref={accountPhotoInputRef}
              type="file"
              accept="image/*"
              onChange={handleAccountPhotoSelected}
              className="hidden"
            />

            <section className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6B5BF7] to-[#5142E6] text-white flex items-center justify-center text-lg font-extrabold shrink-0">
                    {adminInitials}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-extrabold text-slate-900 dark:text-white truncate">
                      {adminName}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-[#A6A0CE]">
                      Campus Administrator · {courses.length} tracked subjects
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-[#8E88BE] truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCreateAccountForm((v) => !v)}
                  className="px-4 py-2.5 min-h-[42px] rounded-full text-xs font-bold text-white bg-gradient-to-r from-[#6B5BF7] to-[#5142E6] hover:from-[#5E4DF0] hover:to-[#4638D6] shadow-md shadow-[#5142E6]/25 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{showCreateAccountForm ? 'Close Form' : 'Create Student / Professor Account'}</span>
                </button>
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

            {/* Create New Student or Professor Account Form */}
            {showCreateAccountForm && (
              <form
                onSubmit={handleCreateAccountRequest}
                className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-5 sm:p-6 space-y-4 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-[#EFEBFD] dark:border-[#2C2654] pb-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      Create New Campus Account
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-[#A6A0CE]">
                      Generated accounts appear below as ID-style cards for approval or rejection
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateAccountForm(false)}
                    className="text-xs font-bold text-slate-500 dark:text-[#A6A0CE] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'student', label: 'Student Account', icon: GraduationCap },
                      { id: 'professor', label: 'Professor Account', icon: BookOpenCheck },
                    ] as const
                  ).map((opt) => {
                    const Icon = opt.icon;
                    const active = newAccountRole === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setNewAccountRole(opt.id);
                          setNewAccountDepartment(
                            opt.id === 'professor'
                              ? 'College of Computing'
                              : 'BSIT · 3rd year · Section A'
                          );
                        }}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                          active
                            ? 'bg-gradient-to-r from-[#6B5BF7] to-[#5142E6] text-white border-[#5142E6]'
                            : 'bg-[#F7F6FE] dark:bg-[#241F4A] text-slate-700 dark:text-[#D1CCEE] border-[#E7E3FA] dark:border-[#322B61]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    placeholder={newAccountRole === 'professor' ? 'Prof. Elena Santos' : 'Maya Cruz'}
                    className="px-3.5 py-2.5 min-h-[42px] text-xs bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl text-slate-900 dark:text-white"
                  />
                  <input
                    type="email"
                    required
                    value={newAccountEmail}
                    onChange={(e) => setNewAccountEmail(e.target.value)}
                    placeholder="name@university.edu"
                    className="px-3.5 py-2.5 min-h-[42px] text-xs bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl text-slate-900 dark:text-white"
                  />
                  <input
                    type="text"
                    value={newAccountDepartment}
                    onChange={(e) => setNewAccountDepartment(e.target.value)}
                    placeholder="Department / Program"
                    className="px-3.5 py-2.5 min-h-[42px] text-xs bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl text-slate-900 dark:text-white"
                  />
                  <input
                    type="text"
                    value={newAccountCode}
                    onChange={(e) => setNewAccountCode(e.target.value)}
                    placeholder="ID Code (optional, auto-generated)"
                    className="px-3.5 py-2.5 min-h-[42px] text-xs bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    disabled={uploadingAccountPhoto}
                    onClick={() => accountPhotoInputRef.current?.click()}
                    className="px-3.5 py-2 min-h-[38px] rounded-full text-xs font-bold bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] text-slate-800 dark:text-white inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-[#5346E8] dark:text-[#A399FF]" />
                    <span>
                      {uploadingAccountPhoto
                        ? 'Processing...'
                        : newAccountPhoto
                        ? 'Change ID Photo'
                        : 'Attach ID Photo (optional)'}
                    </span>
                  </button>

                  <button
                    type="submit"
                    disabled={creatingAccount}
                    className="px-5 py-2.5 min-h-[40px] rounded-full text-xs font-bold text-white bg-gradient-to-r from-[#6B5BF7] to-[#5142E6] cursor-pointer disabled:opacity-60"
                  >
                    {creatingAccount ? 'Creating...' : 'Create Account for Review'}
                  </button>
                </div>
              </form>
            )}

            {/* ID-Style Account Approval & Rejection Queue */}
            <section className="space-y-3.5">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    New Account ID Review
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#A6A0CE]">
                    Review newly created Student and Professor accounts before activating campus access
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-white dark:bg-[#1B1738] border border-[#E7E3FA] dark:border-[#2C2654] text-xs font-mono font-bold text-[#5346E8] dark:text-[#BDB6FF]">
                  {accountRequests.filter((a) => a.status === 'pending').length} pending
                </span>
              </div>

              {accountRequests.length === 0 ? (
                <div className="bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-6 text-center space-y-2">
                  <p className="text-xs font-bold text-slate-700 dark:text-white">
                    No newly created accounts awaiting review yet.
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-[#A6A0CE]">
                    Click &ldquo;Create Student / Professor Account&rdquo; above or wait for a new registration.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {accountRequests.map((req) => {
                    const idCode = req.studentCode || deriveStudentCode(req.id);
                    const bars = Array.from({ length: 34 }, (_, idx) => {
                      const c = `${idCode}-${req.id}`.charCodeAt(idx % `${idCode}-${req.id}`.length);
                      return (c + idx * 5) % 3 === 0 ? 3 : (c + idx) % 2 === 0 ? 2 : 1;
                    });
                    const isPending = req.status === 'pending';

                    return (
                      <article
                        key={req.id}
                        className="rounded-[28px] overflow-hidden border border-[#5B4CEB]/35 dark:border-[#8D81FF]/35 shadow-[0_18px_46px_-14px_rgba(76,60,217,0.3)] grid grid-cols-1 md:grid-cols-[1.55fr_1fr] bg-white dark:bg-[#1B1738]"
                      >
                        {/* ID-Style Card Left Panel */}
                        <div className="bg-gradient-to-br from-[#5240E8] via-[#412FC9] to-[#2F209E] p-5 text-white flex flex-col justify-between gap-4 relative overflow-hidden">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/18 text-[10px] font-extrabold tracking-[0.14em] uppercase">
                              {req.role === 'professor' ? 'PROFESSOR ID' : 'STUDENT ID'}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full bg-white/14 text-[10px] font-semibold">
                              {req.source === 'admin_created' ? 'Admin Created' : 'New Sign-Up'}
                            </span>
                          </div>

                          <div className="flex flex-col min-[360px]:flex-row items-center gap-3.5 sm:gap-4 text-center min-[360px]:text-left">
                            <div className="w-20 h-24 rounded-2xl overflow-hidden bg-[#C7BEFF] border border-white/25 shrink-0 flex items-center justify-center">
                              {req.photoDataUrl ? (
                                <img
                                  src={req.photoDataUrl}
                                  alt={req.fullName}
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

                            <div className="min-w-0 w-full flex-1 space-y-1">
                              <h4 className="text-lg font-extrabold tracking-tight text-white truncate">
                                {req.fullName}
                              </h4>
                              <p className="text-xs font-bold font-mono tabular-nums text-white/95 truncate">
                                {idCode}
                              </p>
                              <p className="text-xs text-white/85 truncate">
                                {req.department || 'Computer Science'}
                              </p>
                              <p className="text-[11px] text-white/75 truncate">{req.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-center pt-1">
                            <div className="flex items-stretch justify-center gap-[2px] h-7 overflow-hidden opacity-90">
                              {bars.map((w, idx) => (
                                <div
                                  key={idx}
                                  className="bg-white rounded-[1px] shrink-0"
                                  style={{ width: `${w * 1.6}px` }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Right Panel: Review Status & Approve / Reject Actions */}
                        <div className="p-5 flex flex-col justify-between gap-4 bg-white dark:bg-[#1B1738]">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#8E88BE]">
                                Account Status
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${
                                  req.status === 'approved'
                                    ? 'bg-[#E6F7EE] dark:bg-[#143D2B] text-[#15803D] dark:text-[#7CE4AF]'
                                    : req.status === 'rejected'
                                    ? 'bg-[#FEE2E2] dark:bg-rose-950/60 text-[#BE123C] dark:text-rose-300'
                                    : 'bg-[#FEF3C7] dark:bg-[#3E2E16] text-[#B45309] dark:text-[#F8C871]'
                                }`}
                              >
                                {req.status}
                              </span>
                            </div>

                            <p className="text-xs font-semibold text-slate-700 dark:text-[#D1CCEE]">
                              {isPending
                                ? 'Verify identity details on this ID card before approving.'
                                : `${req.status === 'approved' ? 'Approved' : 'Rejected'} by ${
                                    req.reviewedBy || 'Admin Office'
                                  }`}
                            </p>
                            <p className="text-[11px] text-slate-400 dark:text-[#8E88BE] font-mono tabular-nums">
                              Created {new Date(req.createdAt).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <button
                              type="button"
                              disabled={req.status === 'approved'}
                              onClick={() => void handleReviewAccountRequest(req, 'approved')}
                              className="py-2.5 px-3 min-h-[40px] rounded-full text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer transition"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              disabled={req.status === 'rejected'}
                              onClick={() => void handleReviewAccountRequest(req, 'rejected')}
                              className="py-2.5 px-3 min-h-[40px] rounded-full text-xs font-bold text-[#BE123C] dark:text-rose-300 bg-[#FEE2E2] dark:bg-rose-950/50 hover:bg-rose-200 dark:hover:bg-rose-900/60 disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer transition"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Popped-Up Search Bar Modal */}
      {headerSearchOpen && (
        <div
          className="fixed inset-0 z-[60] bg-[#110E26]/45 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 px-4"
          onClick={() => setHeaderSearchOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Search campus rooms, professors, and subjects"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] shadow-2xl p-4 sm:p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#5346E8] dark:text-[#A399FF] absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search room, professor, or subject..."
                  className="w-full pl-10 pr-9 py-2.5 min-h-[44px] text-sm bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#6B5BF7]/35 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#8E88BE]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setHeaderSearchOpen(false)}
                className="px-4 py-2.5 min-h-[44px] rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-[#6B5BF7] to-[#5142E6] cursor-pointer shrink-0"
              >
                Done
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-[#EFEBFD] dark:divide-[#2C2654]">
              {filteredRooms.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-[#A6A0CE] py-6 text-center">
                  No rooms, professors, or subjects match &ldquo;{searchQuery}&rdquo;.
                </p>
              ) : (
                filteredRooms.slice(0, 6).map((entry) => {
                  const prof =
                    entry.activeSession?.professorName ||
                    entry.courses[0]?.instructorName ||
                    'Vacant';
                  const subj =
                    entry.activeSession?.courseCode ||
                    entry.courses[0]?.code ||
                    'No active subject';
                  return (
                    <button
                      key={entry.roomKey}
                      type="button"
                      onClick={() => {
                        setRoomFilter(entry.roomKey);
                        setActiveTab('rooms');
                        setHeaderSearchOpen(false);
                      }}
                      className="w-full py-2.5 px-2 text-left flex items-center justify-between gap-3 hover:bg-[#F7F6FE] dark:hover:bg-[#241F4A] rounded-xl transition cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          {entry.room} · {subj}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-[#A6A0CE] truncate">
                          {prof} · {entry.building}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          entry.activeSession?.status === 'active'
                            ? 'bg-[#E6F7EE] dark:bg-[#143D2B] text-[#15803D] dark:text-[#7CE4AF]'
                            : 'bg-[#ECE9FC] dark:bg-[#2A2454] text-[#5346E8] dark:text-[#BDB6FF]'
                        }`}
                      >
                        {entry.activeSession?.status === 'active' ? 'In use' : 'Vacant'}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
