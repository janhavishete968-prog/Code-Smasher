import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import Landing from "./pages/Landing";
import SolverApp from "./pages/App";
import "./App.css";
import { auth, googleProvider, isFirebaseConfigured } from "./firebase";

function getFriendlyAuthError(error) {
  const code = error?.code || "";

  if (code === "auth/popup-closed-by-user") {
    return "Sign-in popup was closed before completion.";
  }

  if (code === "auth/popup-blocked") {
    return "Popup was blocked by the browser. Allow popups and try again.";
  }

  if (code === "auth/unauthorized-domain") {
    return "This domain is not authorized. Add it in Firebase Authentication settings.";
  }

  if (code === "auth/network-request-failed") {
    return "Network error during sign-in. Check your connection and retry.";
  }

  return "Google sign-in failed. Please try again.";
}

export default function AppRouter() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (!auth || !isFirebaseConfigured) {
      setAuthLoading(false);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser) => {
        setUser(nextUser);
        setAuthLoading(false);
      },
      () => {
        setAuthError("Authentication state could not be verified. Please refresh.");
        setAuthLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    setAuthError("");

    if (!auth || !googleProvider || !isFirebaseConfigured) {
      setAuthError("Firebase is not configured. Add VITE_FIREBASE_* environment variables.");
      return;
    }

    setAuthActionLoading(true);
    try {
      googleProvider.setCustomParameters({
        prompt: "select_account",
      });
      await signInWithPopup(auth, googleProvider);
    } catch (loginError) {
      setAuthError(getFriendlyAuthError(loginError));
    } finally {
      setAuthActionLoading(false);
    }
  };

  const logout = async () => {
    if (!auth) {
      return;
    }

    setAuthActionLoading(true);
    try {
      await signOut(auth);
    } catch (logoutError) {
      const code = logoutError?.code || "";
      if (code === "auth/network-request-failed") {
        setAuthError("Network error during logout. Please try again.");
      } else {
        setAuthError("Logout failed. Please try again.");
      }
    } finally {
      setAuthActionLoading(false);
    }
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Landing
              user={user}
              authLoading={authLoading}
              authActionLoading={authActionLoading}
              authError={authError}
              onLogin={loginWithGoogle}
            />
          }
        />
        <Route
          path="/app"
          element={
            <SolverApp
              user={user}
              authLoading={authLoading}
              authActionLoading={authActionLoading}
              authError={authError}
              onLogin={loginWithGoogle}
              onLogout={logout}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
