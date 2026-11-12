# Security Specification: ClientVault

## 1. Data Invariants
1. **User Invariant**: A user document at `/users/{userId}` can only be read and written by the authenticated user whose `request.auth.uid == userId`. Users cannot modify their immutable `id` or impersonate other accounts.
2. **File Isolation Invariant**: Files at `/files/{fileId}` are strictly owned by `ownerId == request.auth.uid`. No user can read, list, update, or delete any file owned by another user.
3. **Client Isolation Invariant**: Clients at `/clients/{clientId}` are strictly owned by `ownerId == request.auth.uid`.
4. **Denial of Wallet Invariant**: All strings, IDs, and payload sizes have strict upper bounds. File records cap data at 800KB.
5. **Default Deny**: All unspecified paths are closed by default `match /{document=**} { allow read, write: if false; }`.

## 2. The Dirty Dozen Payloads (Rejection Matrix)
1. **Unauthenticated File Read**: `GET /files/f123` with `request.auth = null` -> PERMISSION_DENIED
2. **Cross-User File Snooping**: User B reads User A's file -> PERMISSION_DENIED
3. **Owner Spoofing on File Create**: User B writes file with `ownerId = "userA"` -> PERMISSION_DENIED
4. **Blanket Query Scraping**: User attempts unconstrained `collection('files')` query without user filter -> PERMISSION_DENIED
5. **Giant Payload Attack**: Attempting to insert a 2MB base64 payload into `/files/{fileId}` -> PERMISSION_DENIED
6. **Path Traversal / Malformed ID**: Document write to `/files/../../etc/passwd` or non-alphanumeric ID -> PERMISSION_DENIED
7. **Cross-User File Deletion**: User B attempts `DELETE /files/{userA_file}` -> PERMISSION_DENIED
8. **Impersonated Profile Write**: User B attempts `SET /users/{userA}` -> PERMISSION_DENIED
9. **Client Portal Hijack**: User B tries to update a client record owned by User A -> PERMISSION_DENIED
10. **Shadow Field Injection**: Inserting undocumented sensitive fields into file record -> PERMISSION_DENIED
11. **Immutable Key Mutation**: Updating file with altered `ownerId` -> PERMISSION_DENIED
12. **Negative / NaN File Size**: Attempting to upload file with negative `size: -999` -> PERMISSION_DENIED
