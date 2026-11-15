export type UserRole = 'admin' | 'professor' | 'student';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  department?: string;
  studentCode?: string;
  photoDataUrl?: string;
  createdAt: string;
}

export interface DirectoryEntry {
  id: string;
  displayName: string;
  role: UserRole;
  department?: string;
  studentCode?: string;
  campusScope: 'attendly';
  updatedAt: string;
}

export interface CourseRecord {
  id: string;
  code: string;
  title: string;
  department?: string;
  instructorId: string;
  instructorName?: string;
  room: string;
  building: string;
  scheduleDays?: string;
  startTime: string;
  endTime: string;
  capacity?: number;
  enrolledCount?: number;
  status: 'active' | 'archived';
  campusScope: 'attendly';
  createdBy: string;
  createdAt: string;
}

export interface ClassSessionRecord {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  professorId: string;
  professorName?: string;
  room: string;
  building: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  checkInCode: string;
  status: 'scheduled' | 'active' | 'completed';
  campusScope: 'attendly';
  createdBy: string;
  createdAt: string;
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  courseId: string;
  courseCode: string;
  courseTitle?: string;
  studentId: string;
  studentName: string;
  professorId: string;
  room?: string;
  building?: string;
  sessionDate?: string;
  scanMethod?: 'qr' | 'code' | 'manual';
  status: AttendanceStatus;
  checkedInAt: string;
  campusScope: 'attendly';
  createdBy: string;
}

export interface AnnouncementRecord {
  id: string;
  title: string;
  message: string;
  scope: 'official' | 'subject';
  courseId: string;
  courseCode: string;
  courseTitle?: string;
  activityDate?: string;
  photoCount?: number;
  authorId: string;
  authorName: string;
  authorRole: 'admin' | 'professor';
  campusScope: 'attendly';
  createdAt: string;
}

export interface AnnouncementPhotoRecord {
  id: string;
  announcementId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  orderIndex: number;
  dataUrl: string;
  authorId: string;
  campusScope: 'attendly';
  createdAt: string;
}

export interface StudentQRPayload {
  app: 'attendly';
  studentId: string;
  studentName: string;
  studentCode: string;
  department: string;
}
