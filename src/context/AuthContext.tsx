import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup,
  signOut,
  updateProfile,
  signInAnonymously
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType, testFirestoreConnection } from '../lib/firebase';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: 'freelancer' | 'client';
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string, role: 'freelancer' | 'client') => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInDemoAccount: (role?: 'freelancer' | 'client') => Promise<void>;
  signOutUser: () => Promise<void>;
  clearAuthError: () => void;
  updateUserRole: (role: 'freelancer' | 'client') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Test connection on mount
  useEffect(() => {
    testFirestoreConnection().catch(() => {});
  }, []);

  // Listen to auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(userDocRef);
          
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            // Create user profile document if first time
            const newProfile: UserProfile = {
              id: currentUser.uid,
              email: currentUser.email || 'user@clientvault.app',
              displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Vault User',
              role: 'freelancer',
              createdAt: new Date().toISOString()
            };
            await setDoc(userDocRef, newProfile);
            setUserProfile(newProfile);
          }
        } catch (error) {
          console.warn('Could not load or sync user profile from Firestore:', error);
          // Set a fallback in-memory profile so user is not blocked
          setUserProfile({
            id: currentUser.uid,
            email: currentUser.email || 'user@clientvault.app',
            displayName: currentUser.displayName || 'Vault User',
            role: 'freelancer',
            createdAt: new Date().toISOString()
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
    } catch (err: any) {
      console.error('Sign In Error:', err);
      let msg = 'Failed to sign in. Please verify your email and password.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        msg = 'Invalid email or password. Please try again or create an account.';
      } else if (err.code === 'auth/wrong-password') {
        msg = 'Incorrect password. Please try again.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (err.code === 'auth/operation-not-allowed') {
        msg = 'Email/Password sign-in is not enabled in Firebase Console. Please use Demo Account or Google Sign In.';
      }
      setAuthError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name: string, role: 'freelancer' | 'client') => {
    setAuthError(null);
    setLoading(true);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      const newUser = userCred.user;
      
      if (name.trim()) {
        try {
          await updateProfile(newUser, { displayName: name.trim() });
        } catch {
          // ignore
        }
      }

      const profileData: UserProfile = {
        id: newUser.uid,
        email: newUser.email || email.trim(),
        displayName: name.trim() || email.split('@')[0],
        role: role,
        createdAt: new Date().toISOString()
      };

      try {
        await setDoc(doc(db, 'users', newUser.uid), profileData);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${newUser.uid}`);
      }
      setUserProfile(profileData);
    } catch (err: any) {
      console.error('Sign Up Error:', err);
      let msg = 'Failed to create an account.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Please Sign In.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters long.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (err.code === 'auth/operation-not-allowed') {
        msg = 'Email/Password sign-up is not enabled in Firebase Console. Please use Demo Account or Google Sign In.';
      }
      setAuthError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setAuthError(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const userDocRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userDocRef);
      if (!snap.exists()) {
        const newProfile: UserProfile = {
          id: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Vault Member',
          role: 'freelancer',
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, newProfile);
        setUserProfile(newProfile);
      }
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setAuthError(err.message || 'Google Sign-In failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const signInDemoAccount = async (role: 'freelancer' | 'client' = 'freelancer') => {
    setAuthError(null);
    setLoading(true);
    try {
      // Use Firebase Anonymous auth for seamless demo mode
      const result = await signInAnonymously(auth);
      const demoUser = result.user;
      const displayName = role === 'freelancer' ? 'Alex Rivera (Studio Lead)' : 'Sarah Chen (Acme Corp)';
      const email = role === 'freelancer' ? 'alex.rivera@designstudio.com' : 'sarah@acme.com';

      const demoProfile: UserProfile = {
        id: demoUser.uid,
        email,
        displayName,
        role,
        createdAt: new Date().toISOString()
      };

      try {
        await setDoc(doc(db, 'users', demoUser.uid), demoProfile);
      } catch {
        // ignore if anonymous rules restrict
      }
      setUserProfile(demoProfile);
    } catch (err: any) {
      console.error('Demo Sign In Error:', err);
      setAuthError('Unable to sign in with demo mode. Please try Email Sign In.');
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
    } catch (err: any) {
      console.error('Sign Out Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (role: 'freelancer' | 'client') => {
    if (!user) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { role }, { merge: true });
      if (userProfile) {
        setUserProfile({ ...userProfile, role });
      }
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
        signInDemoAccount,
        signOutUser,
        clearAuthError,
        updateUserRole,
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
