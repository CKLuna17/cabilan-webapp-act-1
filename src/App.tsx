/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './components/AuthPage';
import { Sidebar, DashboardTab } from './components/Sidebar';
import { AttendlyLogo } from './components/AttendlyLogo';
import { AdminDashboard } from './components/dashboards/AdminDashboard';
import { ProfessorDashboard } from './components/dashboards/ProfessorDashboard';
import { StudentDashboard } from './components/dashboards/StudentDashboard';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import {
  CourseRecord,
  ClassSessionRecord,
  AttendanceRecord,
  DirectoryEntry,
  AnnouncementRecord,
  AnnouncementPhotoRecord,
  UserRole,
} from './types/attendly';
import { CheckCircle2 } from 'lucide-react';

function defaultTabForRole(role: UserRole): DashboardTab {
  if (role === 'admin') return 'overview';
  if (role === 'professor') return 'schedule';
  return 'calendar';
}

function Dashboard() {
  const { user, userProfile, updateUserRole } = useAuth();
  const persistedRole: UserRole = userProfile?.role || 'student';

  const [viewRole, setViewRole] = useState<UserRole>(persistedRole);
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => defaultTabForRole(persistedRole));
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [sessions, setSessions] = useState<ClassSessionRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [announcementPhotos, setAnnouncementPhotos] = useState<AnnouncementPhotoRecord[]>([]);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setViewRole(persistedRole);
    setActiveTab(defaultTabForRole(persistedRole));
  }, [persistedRole]);

  useEffect(() => {
    if (!user) {
      setReadAnnouncementIds([]);
      return;
    }
    try {
      const saved = localStorage.getItem(`attendly_read_ann_${user.uid}`);
      if (saved) {
        setReadAnnouncementIds(JSON.parse(saved) as string[]);
      }
    } catch {
      // ignore storage errors
    }
  }, [user]);

  const persistReadIds = (nextIds: string[]) => {
    setReadAnnouncementIds(nextIds);
    if (user) {
      try {
        localStorage.setItem(`attendly_read_ann_${user.uid}`, JSON.stringify(nextIds));
      } catch {
        // ignore storage errors
      }
    }
  };

  const handleMarkAnnouncementRead = (id: string) => {
    if (!readAnnouncementIds.includes(id)) {
      persistReadIds([...readAnnouncementIds, id]);
    }
  };

  const handleMarkSubjectRead = (courseId: string) => {
    const idsForSubject = announcements
      .filter((a) => a.scope === 'subject' && a.courseId === courseId)
      .map((a) => a.id);
    const merged = Array.from(new Set([...readAnnouncementIds, ...idsForSubject]));
    persistReadIds(merged);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const handleSelectViewRole = async (nextRole: UserRole) => {
    if (persistedRole === 'admin') {
      setViewRole(nextRole);
      setActiveTab(defaultTabForRole(nextRole));
      return;
    }
    await updateUserRole(nextRole);
    setViewRole(nextRole);
    setActiveTab(defaultTabForRole(nextRole));
  };

  useEffect(() => {
    if (!user) {
      setCourses([]);
      return;
    }

    const coursesQuery = query(
      collection(db, 'courses'),
      where('campusScope', '==', 'attendly')
    );

    const unsubscribe = onSnapshot(
      coursesQuery,
      (snapshot) => {
        const list: CourseRecord[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as CourseRecord);
        });
        setCourses(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'courses');
      }
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      return;
    }

    const sessionsQuery = query(
      collection(db, 'sessions'),
      where('campusScope', '==', 'attendly')
    );

    const unsubscribe = onSnapshot(
      sessionsQuery,
      (snapshot) => {
        const list: ClassSessionRecord[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as ClassSessionRecord);
        });
        setSessions(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'sessions');
      }
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setAttendance([]);
      return;
    }

    const filterField =
      viewRole === 'student' ? 'studentId' : viewRole === 'professor' ? 'professorId' : 'createdBy';

    const attendanceQuery = query(
      collection(db, 'attendance'),
      where(filterField, '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      attendanceQuery,
      (snapshot) => {
        const list: AttendanceRecord[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as AttendanceRecord);
        });
        setAttendance(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'attendance');
      }
    );

    return () => unsubscribe();
  }, [user, viewRole]);

  useEffect(() => {
    if (!user) {
      setDirectory([]);
      return;
    }

    const directoryQuery = query(
      collection(db, 'directory'),
      where('campusScope', '==', 'attendly')
    );

    const unsubscribe = onSnapshot(
      directoryQuery,
      (snapshot) => {
        const list: DirectoryEntry[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as DirectoryEntry);
        });
        setDirectory(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'directory');
      }
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setAnnouncements([]);
      return;
    }

    const announcementsQuery = query(
      collection(db, 'announcements'),
      where('campusScope', '==', 'attendly')
    );

    const unsubscribe = onSnapshot(
      announcementsQuery,
      (snapshot) => {
        const list: AnnouncementRecord[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as AnnouncementRecord);
        });
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setAnnouncements(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'announcements');
      }
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setAnnouncementPhotos([]);
      return;
    }

    const photosQuery = query(
      collection(db, 'announcementPhotos'),
      where('campusScope', '==', 'attendly')
    );

    const unsubscribe = onSnapshot(
      photosQuery,
      (snapshot) => {
        const list: AnnouncementPhotoRecord[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as AnnouncementPhotoRecord);
        });
        list.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
        setAnnouncementPhotos(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'announcementPhotos');
      }
    );

    return () => unsubscribe();
  }, [user]);

  const activeSessionCount = sessions.filter((s) => s.status === 'active').length;
  const unreadSubjectAnnouncements = useMemo(
    () =>
      announcements.filter((a) => a.scope === 'subject' && !readAnnouncementIds.includes(a.id))
        .length,
    [announcements, readAnnouncementIds]
  );

  const isAdminPreview = persistedRole === 'admin' && viewRole !== 'admin';

  return (
    <div
      className="flex min-h-[100dvh] lg:h-screen lg:overflow-hidden font-sans bg-cover bg-center bg-no-repeat bg-fixed relative"
      style={{ backgroundImage: `url('/assets/aistudio/image_2e397125.png')` }}
    >
      {/* Subtle overlay for depth and high contrast readability */}
      <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-[1px] pointer-events-none" />

      <Sidebar
        activeRole={viewRole}
        onSelectViewRole={handleSelectViewRole}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeSessionCount={activeSessionCount}
        coursesCount={courses.length}
        announcementsCount={announcements.length}
        unreadAnnouncementsCount={unreadSubjectAnnouncements}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {viewRole === 'admin' && (
        <AdminDashboard
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenMenu={() => setMobileMenuOpen(true)}
          onSwitchDashboard={(target) => {
            setViewRole(target);
            setActiveTab(defaultTabForRole(target));
          }}
          courses={courses}
          sessions={sessions}
          attendance={attendance}
          directory={directory}
          announcements={announcements}
          announcementPhotos={announcementPhotos}
          onNotify={showToast}
        />
      )}

      {viewRole === 'professor' && (
        <ProfessorDashboard
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenMenu={() => setMobileMenuOpen(true)}
          isAdminPreview={isAdminPreview}
          onReturnToAdmin={() => {
            setViewRole('admin');
            setActiveTab('overview');
          }}
          courses={courses}
          sessions={sessions}
          attendance={attendance}
          announcements={announcements}
          directory={directory}
          onNotify={showToast}
        />
      )}

      {viewRole === 'student' && (
        <StudentDashboard
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenMenu={() => setMobileMenuOpen(true)}
          isAdminPreview={isAdminPreview}
          onReturnToAdmin={() => {
            setViewRole('admin');
            setActiveTab('overview');
          }}
          courses={courses}
          sessions={sessions}
          attendance={attendance}
          announcements={announcements}
          announcementPhotos={announcementPhotos}
          readAnnouncementIds={readAnnouncementIds}
          onMarkSubjectRead={handleMarkSubjectRead}
          onMarkAnnouncementRead={handleMarkAnnouncementRead}
          onNotify={showToast}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:bottom-6 sm:right-6 z-50 bg-slate-900/90 backdrop-blur-xl text-white px-4 py-3 rounded-xl shadow-xl border border-white/15 flex items-center gap-2.5 text-xs font-medium max-w-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        className="min-h-[100dvh] bg-cover bg-center bg-no-repeat flex flex-col items-center justify-center text-white relative p-4"
        style={{ backgroundImage: `url('/assets/aistudio/image_2e397125.png')` }}
      >
        <div className="absolute inset-0 bg-slate-900/15 backdrop-blur-[1px] pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-3">
            <AttendlyLogo size="md" />
          </div>
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-white/95 font-medium tracking-wide drop-shadow-xs">
            Connecting to Attendly...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
