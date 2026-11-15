import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from '../lib/firebase';
import { deriveStudentCode } from '../lib/attendlySeed';
import { UserProfile, UserRole } from '../types/attendly';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string, role: UserRole, department?: string) => Promise<void>;
  signInWithGoogle: (preferredRole?: UserRole) => Promise<void>;
  signOutUser: () => Promise<void>;
  clearAuthError: () => void;
  updateUserRole: (role: UserRole) => Promise<void>;
  updateUserPhoto: (photoDataUrl: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeRole(rawRole: unknown): UserRole {
  if (rawRole === 'admin') return 'admin';
  if (rawRole === 'professor' || rawRole === 'freelancer') return 'professor';
  if (rawRole === 'student' || rawRole === 'client') return 'student';
  return 'student';
}

async function syncDirectoryEntry(profile: UserProfile) {
  try {
    await setDoc(
      doc(db, 'directory', profile.id),
      {
        id: profile.id,
        displayName: profile.displayName || 'Attendly Member',
        role: profile.role,
        department: profile.department || 'Computer Science',
        studentCode: profile.studentCode || deriveStudentCode(profile.id),
        campusScope: 'attendly',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Directory sync skipped:', err);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    testFirestoreConnection().catch(() => {});
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const defaultCode = deriveStudentCode(currentUser.uid);
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(userDocRef);

          if (docSnap.exists()) {
            const rawData = docSnap.data();
            const normalized: UserProfile = {
              id: rawData.id || currentUser.uid,
              email: rawData.email || currentUser.email || '',
              displayName: rawData.displayName || currentUser.displayName || currentUser.email?.split('@')[0] || 'Attendly Member',
              role: normalizeRole(rawData.role),
              department: rawData.department || 'Computer Science',
              studentCode: rawData.studentCode || defaultCode,
              photoDataUrl: typeof rawData.photoDataUrl === 'string' ? rawData.photoDataUrl : undefined,
              createdAt: rawData.createdAt || new Date().toISOString(),
            };
            setUserProfile(normalized);
            await syncDirectoryEntry(normalized);
          } else {
            const newProfile: UserProfile = {
              id: currentUser.uid,
              email: currentUser.email || 'user@attendly.edu',
              displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Attendly Member',
              role: 'student',
              department: 'Computer Science',
              studentCode: defaultCode,
              createdAt: new Date().toISOString(),
            };
            await setDoc(userDocRef, newProfile);
            await syncDirectoryEntry(newProfile);
            setUserProfile(newProfile);
          }
        } catch (error) {
          console.warn('Could not load or sync user profile from Firestore:', error);
          setUserProfile({
            id: currentUser.uid,
            email: currentUser.email || 'user@attendly.edu',
            displayName: currentUser.displayName || 'Attendly Member',
            role: 'student',
            department: 'Computer Science',
            studentCode: defaultCode,
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const clearAuthError = () => setAuthError(null);

  const signInWithEmail = async (email: string, pass: string) => {
    setAuthError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch (err: unknown) {
      const errorObj = err as { code?: string };
      let msg = 'Failed to sign in. Please verify your email and password.';
      if (errorObj.code === 'auth/user-not-found' || errorObj.code === 'auth/invalid-credential') {
        msg = 'Invalid email or password. Please try again or create an account.';
      } else if (errorObj.code === 'auth/wrong-password') {
        msg = 'Incorrect password. Please try again.';
      } else if (errorObj.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (errorObj.code === 'auth/operation-not-allowed') {
        msg = 'Email/Password sign-in is not enabled in Firebase Console. Please use Google Sign In or enable Email/Password auth.';
      }
      setAuthError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (
    email: string,
    pass: string,
    name: string,
    role: UserRole,
    department = 'Computer Science'
  ) => {
    setAuthError(null);
    setLoading(true);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      const newUser = userCred.user;

      if (name.trim()) {
        try {
          await updateProfile(newUser, { displayName: name.trim() });
        } catch {
          // ignore profile update failures
        }
      }

      const profileData: UserProfile = {
        id: newUser.uid,
        email: newUser.email || email.trim(),
        displayName: name.trim() || email.split('@')[0],
        role,
        department,
        studentCode: deriveStudentCode(newUser.uid),
        createdAt: new Date().toISOString(),
      };

      try {
        await setDoc(doc(db, 'users', newUser.uid), profileData);
        await syncDirectoryEntry(profileData);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${newUser.uid}`);
      }
      setUserProfile(profileData);
    } catch (err: unknown) {
      const errorObj = err as { code?: string };
      let msg = 'Failed to create an account.';
      if (errorObj.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Please Sign In.';
      } else if (errorObj.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters long.';
      } else if (errorObj.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (errorObj.code === 'auth/operation-not-allowed') {
        msg = 'Email/Password sign-up is not enabled in Firebase Console. Please use Google Sign In or enable Email/Password auth.';
      }
      setAuthError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async (preferredRole: UserRole = 'student') => {
    setAuthError(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const signedInUser = result.user;
      const userDocRef = doc(db, 'users', signedInUser.uid);
      const snap = await getDoc(userDocRef);
      if (!snap.exists()) {
        const newProfile: UserProfile = {
          id: signedInUser.uid,
          email: signedInUser.email || '',
          displayName: signedInUser.displayName || 'Attendly Member',
          role: preferredRole,
          department: 'Computer Science',
          studentCode: deriveStudentCode(signedInUser.uid),
          createdAt: new Date().toISOString(),
        };
        await setDoc(userDocRef, newProfile);
        await syncDirectoryEntry(newProfile);
        setUserProfile(newProfile);
      }
    } catch (err: unknown) {
      const errorObj = err as { code?: string; message?: string };
      if (errorObj.code !== 'auth/popup-closed-by-user') {
        setAuthError(errorObj.message || 'Google Sign-In failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const signOutUser = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
    } catch (err) {
      console.error('Sign Out Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (role: UserRole) => {
    if (!user) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { role }, { merge: true });
      const updatedProfile: UserProfile = userProfile
        ? { ...userProfile, role }
        : {
            id: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'Attendly Member',
            role,
            department: 'Computer Science',
            studentCode: deriveStudentCode(user.uid),
            createdAt: new Date().toISOString(),
          };
      setUserProfile(updatedProfile);
      await syncDirectoryEntry(updatedProfile);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const updateUserPhoto = async (photoDataUrl: string) => {
    if (!user) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { photoDataUrl }, { merge: true });
      setUserProfile((prev) =>
        prev
          ? { ...prev, photoDataUrl }
          : {
              id: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'Attendly Member',
              role: 'student',
              department: 'Computer Science',
              studentCode: deriveStudentCode(user.uid),
              photoDataUrl,
              createdAt: new Date().toISOString(),
            }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        authError,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOutUser,
        clearAuthError,
        updateUserRole,
        updateUserPhoto,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
