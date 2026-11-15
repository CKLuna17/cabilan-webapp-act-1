# Security Specification: Attendly (Student Tracker Portal)

## 1. Data Invariants
1. **User Profile PII Isolation**: `/users/{userId}` contains email and account metadata and can only be read or written by the owner (`request.auth.uid == userId`).
2. **Non-PII Directory**: `/directory/{userId}` exposes only non-PII campus roster fields (`displayName`, `role`, `department`) with strict key allowlisting and size limits.
3. **Course & Session Integrity**: `/courses/{courseId}` and `/sessions/{sessionId}` can only be created, updated, or deleted by authenticated Admins or the assigned Professor (`instructorId` / `professorId` / `createdBy == request.auth.uid`).
4. **Attendance Isolation**: `/attendance/{recordId}` list queries enforce `resource.data.studentId == request.auth.uid || resource.data.professorId == request.auth.uid || resource.data.createdBy == request.auth.uid` with zero `get()` lookups inside `allow list`.
5. **Denial-of-Wallet & ID Guarding**: Every document ID matches `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), every string has explicit `.size()` bounds, and every create/update enforces `keys().hasAll(...)` / `keys().hasOnly(...)` / `affectedKeys().hasOnly(...)`.
6. **Default Deny**: Unspecified paths are closed via `match /{document=**} { allow read, write: if false; }`.

## 2. The Dirty Dozen Payloads (Rejection Matrix)
1. **Unauthenticated Course Read**: `LIST /courses` with `request.auth = null` -> PERMISSION_DENIED
2. **Cross-User PII Snooping**: User B attempts `GET /users/{userA}` -> PERMISSION_DENIED
3. **Student Course Creation**: Student attempts `CREATE /courses/c1` -> PERMISSION_DENIED
4. **Professor Hijacking Another Professor's Session**: Professor B updates Professor A's session -> PERMISSION_DENIED
5. **Blanket Attendance Scraping**: Student queries `collection('attendance')` without `studentId == uid` -> PERMISSION_DENIED
6. **Path Traversal / Malformed ID**: Write to `/sessions/../../bad` -> PERMISSION_DENIED
7. **Shadow Field Injection**: Course create containing extra undocumented field `isVerified: true` -> PERMISSION_DENIED
8. **Giant String Poisoning**: Session title with 50KB string -> PERMISSION_DENIED
9. **Student Forging Another Student's Check-In**: Student B creates attendance with `studentId: "studentA"` -> PERMISSION_DENIED
10. **Immutable Creator Mutation**: Updating a course while changing `createdBy` -> PERMISSION_DENIED
11. **Invalid Attendance Status**: Creating attendance with `status: "hacked"` -> PERMISSION_DENIED
12. **Negative Course Capacity**: Creating course with `capacity: -10` -> PERMISSION_DENIED
