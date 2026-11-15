import { writeBatch, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  CourseRecord,
  ClassSessionRecord,
  AttendanceRecord,
  AnnouncementRecord,
} from '../types/attendly';

export function generateCheckInCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function deriveStudentCode(uid: string): string {
  const clean = uid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `STU-${clean.slice(0, 6).padEnd(6, '0')}`;
}

export async function seedCampusData(userId: string, displayName: string) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const createdAt = now.toISOString();
  const batch = writeBatch(db);

  const courses: CourseRecord[] = [
    {
      id: `course_${userId.slice(0, 8)}_cs201`,
      code: 'CS 201',
      title: 'Data Structures & Algorithms',
      department: 'Computer Science',
      instructorId: userId,
      instructorName: displayName,
      room: 'Room 304',
      building: 'Turing Hall',
      scheduleDays: 'Mon · Wed · Fri',
      startTime: '09:00 AM',
      endTime: '10:15 AM',
      capacity: 45,
      enrolledCount: 38,
      status: 'active',
      campusScope: 'attendly',
      createdBy: userId,
      createdAt,
    },
    {
      id: `course_${userId.slice(0, 8)}_math180`,
      code: 'MATH 180',
      title: 'Linear Algebra & Matrix Theory',
      department: 'Mathematics',
      instructorId: userId,
      instructorName: 'Prof. Elena Gomez',
      room: 'Room 210',
      building: 'Euler Pavilion',
      scheduleDays: 'Tue · Thu',
      startTime: '11:00 AM',
      endTime: '12:30 PM',
      capacity: 60,
      enrolledCount: 52,
      status: 'active',
      campusScope: 'attendly',
      createdBy: userId,
      createdAt,
    },
    {
      id: `course_${userId.slice(0, 8)}_phys110`,
      code: 'PHYS 110',
      title: 'Applied Mechanics & Optics',
      department: 'Physics',
      instructorId: userId,
      instructorName: 'Prof. Marcus Reid',
      room: 'Lab 108',
      building: 'Maxwell Science Center',
      scheduleDays: 'Mon · Wed',
      startTime: '02:00 PM',
      endTime: '03:30 PM',
      capacity: 32,
      enrolledCount: 29,
      status: 'active',
      campusScope: 'attendly',
      createdBy: userId,
      createdAt,
    },
  ];

  const sessions: ClassSessionRecord[] = [
    {
      id: `sess_${userId.slice(0, 8)}_cs201_today`,
      courseId: courses[0].id,
      courseCode: courses[0].code,
      courseTitle: courses[0].title,
      professorId: userId,
      professorName: displayName,
      room: courses[0].room,
      building: courses[0].building,
      sessionDate: todayStr,
      startTime: courses[0].startTime,
      endTime: courses[0].endTime,
      checkInCode: 'TR304A',
      status: 'active',
      campusScope: 'attendly',
      createdBy: userId,
      createdAt,
    },
    {
      id: `sess_${userId.slice(0, 8)}_math180_today`,
      courseId: courses[1].id,
      courseCode: courses[1].code,
      courseTitle: courses[1].title,
      professorId: userId,
      professorName: 'Prof. Elena Gomez',
      room: courses[1].room,
      building: courses[1].building,
      sessionDate: todayStr,
      startTime: courses[1].startTime,
      endTime: courses[1].endTime,
      checkInCode: 'EU210B',
      status: 'scheduled',
      campusScope: 'attendly',
      createdBy: userId,
      createdAt,
    },
    {
      id: `sess_${userId.slice(0, 8)}_phys110_today`,
      courseId: courses[2].id,
      courseCode: courses[2].code,
      courseTitle: courses[2].title,
      professorId: userId,
      professorName: 'Prof. Marcus Reid',
      room: courses[2].room,
      building: courses[2].building,
      sessionDate: todayStr,
      startTime: courses[2].startTime,
      endTime: courses[2].endTime,
      checkInCode: 'MX108C',
      status: 'completed',
      campusScope: 'attendly',
      createdBy: userId,
      createdAt,
    },
  ];

  const attendanceRecords: AttendanceRecord[] = [
    {
      id: `att_${userId.slice(0, 8)}_1`,
      sessionId: sessions[2].id,
      courseId: courses[2].id,
      courseCode: courses[2].code,
      courseTitle: courses[2].title,
      studentId: userId,
      studentName: displayName,
      professorId: userId,
      room: courses[2].room,
      building: courses[2].building,
      sessionDate: todayStr,
      scanMethod: 'qr',
      status: 'present',
      checkedInAt: createdAt,
      campusScope: 'attendly',
      createdBy: userId,
    },
    {
      id: `att_${userId.slice(0, 8)}_2`,
      sessionId: sessions[0].id,
      courseId: courses[0].id,
      courseCode: courses[0].code,
      courseTitle: courses[0].title,
      studentId: 'student_maya_lin',
      studentName: 'Maya Lin',
      professorId: userId,
      room: courses[0].room,
      building: courses[0].building,
      sessionDate: todayStr,
      scanMethod: 'qr',
      status: 'present',
      checkedInAt: createdAt,
      campusScope: 'attendly',
      createdBy: userId,
    },
  ];

  const announcements: AnnouncementRecord[] = [
    {
      id: `ann_${userId.slice(0, 8)}_official1`,
      title: 'Annual Campus Innovation Fair & Assembly',
      message:
        'All students and faculty are invited to the Main Quad Auditorium this Friday at 1:30 PM for the Annual Campus Innovation Fair. Regular afternoon labs resume at 3:00 PM.',
      scope: 'official',
      courseId: 'all',
      courseCode: 'CAMPUS',
      courseTitle: 'Official School Activity',
      activityDate: todayStr,
      authorId: userId,
      authorName: 'Office of Academic Affairs',
      authorRole: 'admin',
      campusScope: 'attendly',
      createdAt,
    },
    {
      id: `ann_${userId.slice(0, 8)}_cs201`,
      title: 'Bring Laptop for Graph Traversal Lab',
      message:
        'Please bring your laptop charged for today’s CS 201 session in Turing Hall Room 304. Have your Attendly Student QR ready at the door.',
      scope: 'subject',
      courseId: courses[0].id,
      courseCode: courses[0].code,
      courseTitle: courses[0].title,
      activityDate: todayStr,
      authorId: userId,
      authorName: displayName,
      authorRole: 'professor',
      campusScope: 'attendly',
      createdAt,
    },
  ];

  for (const c of courses) {
    batch.set(doc(db, 'courses', c.id), c);
  }
  for (const s of sessions) {
    batch.set(doc(db, 'sessions', s.id), s);
  }
  for (const a of attendanceRecords) {
    batch.set(doc(db, 'attendance', a.id), a);
  }
  for (const ann of announcements) {
    batch.set(doc(db, 'announcements', ann.id), ann);
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'courses|sessions|attendance|announcements');
  }
}
