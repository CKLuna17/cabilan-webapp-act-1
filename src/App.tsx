/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthPage } from './components/AuthPage';
import { Sidebar, DashboardTab } from './components/Sidebar';
import { AttendlyLogo } from './components/AttendlyLogo';
import { AdminDashboard } from './components/dashboards/AdminDashboard';
import { ProfessorDashboard } from './components/dashboards/ProfessorDashboard';
import { StudentDashboard } from './components/dashboards/StudentDashboard';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import {
  CourseRecord,
  ClassSessionRecord,
  AttendanceRecord,
  DirectoryEntry,
  AnnouncementRecord,
  AnnouncementPhotoRecord,
  AnnouncementReactionRecord,
  AccountRequestRecord,
  UserRole,
} from './types/attendly';
import { CheckCircle2 } from 'lucide-react';

function defaultTabForRole(role: UserRole): DashboardTab {
  if (role === 'admin') return 'overview';
  if (role === 'professor') return 'schedule';
  return 'calendar';
}

function Dashboard() {
  const { user, userProfile } = useAuth();
  const activeRole: UserRole = userProfile?.role || 'student';

  const [activeTab, setActiveTab] = useState<DashboardTab>(() => defaultTabForRole(activeRole));
  const [profScannerOpen, setProfScannerOpen] = useState<boolean>(false);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [sessions, setSessions] = useState<ClassSessionRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [accountRequests, setAccountRequests] = useState<AccountRequestRecord[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [announcementPhotos, setAnnouncementPhotos] = useState<AnnouncementPhotoRecord[]>([]);
  const [reactions, setReactions] = useState<AnnouncementReactionRecord[]>([]);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(defaultTabForRole(activeRole));
  }, [activeRole]);

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

  const handleToggleReaction = async (
    ann: AnnouncementRecord,
    reactionType: 'gotIt' | 'thanks'
  ) => {
    if (!user) return;
    const reactionId = `${ann.id}_${user.uid}`;
    const existing = reactions.find((r) => r.id === reactionId);
    const updatedAt = new Date().toISOString();

    try {
      if (existing) {
        const nextGotIt = reactionType === 'gotIt' ? !existing.gotIt : existing.gotIt;
        const nextThanks = reactionType === 'thanks' ? !existing.thanks : existing.thanks;
        await updateDoc(doc(db, 'announcementReactions', reactionId), {
          gotIt: nextGotIt,
          thanks: nextThanks,
          updatedAt,
        });
      } else {
        const record: AnnouncementReactionRecord = {
          id: reactionId,
          announcementId: ann.id,
          userId: user.uid,
          gotIt: reactionType === 'gotIt',
          thanks: reactionType === 'thanks',
          campusScope: 'attendly',
          updatedAt,
        };
        await setDoc(doc(db, 'announcementReactions', reactionId), record);
      }
    } catch (err) {
      handleFirestoreError(
        err,
        existing ? OperationType.UPDATE : OperationType.CREATE,
        `announcementReactions/${reactionId}`
      );
    }
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
      activeRole === 'student' ? 'studentId' : activeRole === 'professor' ? 'professorId' : 'createdBy';

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
  }, [user, activeRole]);

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

  useEffect(() => {
    if (!user) {
      setReactions([]);
      return;
    }

    const reactionsQuery = query(
      collection(db, 'announcementReactions'),
      where('campusScope', '==', 'attendly')
    );

    const unsubscribe = onSnapshot(
      reactionsQuery,
      (snapshot) => {
        const list: AnnouncementReactionRecord[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as AnnouncementReactionRecord);
        });
        setReactions(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'announcementReactions');
      }
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setAccountRequests([]);
      return;
    }

    const reqQuery = query(
      collection(db, 'accountRequests'),
      where('campusScope', '==', 'attendly')
    );

    const unsubscribe = onSnapshot(
      reqQuery,
      (snapshot) => {
        const list: AccountRequestRecord[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as AccountRequestRecord);
        });
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setAccountRequests(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'accountRequests');
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

  return (
    <div className="fixed inset-0 h-[100dvh] max-h-[100dvh] w-full flex flex-col xl:flex-row overflow-hidden font-sans bg-[#ECE9FC] bg-[radial-gradient(circle_at_14%_8%,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0)_48%),linear-gradient(145deg,rgba(255,255,255,0.72)_0%,rgba(236,233,252,0.92)_52%,rgba(255,255,255,0.48)_100%)] dark:bg-[#110E26] dark:bg-[radial-gradient(circle_at_14%_8%,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_46%),linear-gradient(145deg,rgba(255,255,255,0.06)_0%,rgba(17,14,38,0.98)_52%,rgba(255,255,255,0.035)_100%)] text-slate-900 dark:text-white transition-colors duration-200 smooth-resize">
      <Sidebar
        activeRole={activeRole}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeSessionCount={activeSessionCount}
        coursesCount={courses.length}
        announcementsCount={announcements.length}
        unreadAnnouncementsCount={unreadSubjectAnnouncements}
        centerActive={activeRole === 'professor' ? profScannerOpen : false}
        onMobileCenterAction={
          activeRole === 'professor'
            ? () => {
                if (courses.length === 0 || sessions.length === 0) {
                  showToast('Load or create a subject session before scanning QR codes');
                  return;
                }
                setProfScannerOpen(true);
              }
            : undefined
        }
      />

      {activeRole === 'admin' && (
        <AdminDashboard
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          courses={courses}
          sessions={sessions}
          attendance={attendance}
          directory={directory}
          accountRequests={accountRequests}
          announcements={announcements}
          announcementPhotos={announcementPhotos}
          onNotify={showToast}
        />
      )}

      {activeRole === 'professor' && (
        <ProfessorDashboard
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          courses={courses}
          sessions={sessions}
          attendance={attendance}
          announcements={announcements}
          reactions={reactions}
          directory={directory}
          scannerOpen={profScannerOpen}
          setScannerOpen={setProfScannerOpen}
          onNotify={showToast}
        />
      )}

      {activeRole === 'student' && (
        <StudentDashboard
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          courses={courses}
          sessions={sessions}
          attendance={attendance}
          announcements={announcements}
          announcementPhotos={announcementPhotos}
          reactions={reactions}
          readAnnouncementIds={readAnnouncementIds}
          onMarkSubjectRead={handleMarkSubjectRead}
          onMarkAnnouncementRead={handleMarkAnnouncementRead}
          onToggleReaction={handleToggleReaction}
          onNotify={showToast}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 xl:bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-[60] bg-[#171332] dark:bg-white text-white dark:text-[#171332] px-4 py-3 rounded-2xl shadow-xl border border-[#2C2654] dark:border-[#E7E3FA] flex items-center gap-2.5 text-xs font-bold max-w-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
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
      <div className="min-h-[100dvh] bg-[#ECE9FC] bg-[radial-gradient(circle_at_14%_8%,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0)_48%),linear-gradient(145deg,rgba(255,255,255,0.72)_0%,rgba(236,233,252,0.92)_52%,rgba(255,255,255,0.48)_100%)] dark:bg-[#110E26] dark:bg-[radial-gradient(circle_at_14%_8%,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_46%),linear-gradient(145deg,rgba(255,255,255,0.06)_0%,rgba(17,14,38,0.98)_52%,rgba(255,255,255,0.035)_100%)] flex flex-col items-center justify-center text-slate-900 dark:text-white relative p-4 transition-colors duration-200">
        <div className="flex flex-col items-center">
          <div className="mb-3">
            <AttendlyLogo size="md" showGlow />
          </div>
          <div className="w-6 h-6 border-2 border-[#6B5BF7] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-slate-600 dark:text-[#A6A0CE] font-semibold tracking-wide">
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
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
