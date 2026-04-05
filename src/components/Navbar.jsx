import { Link } from "react-router-dom";

export default function Navbar({
  user,
  authLoading,
  authActionLoading,
  authError,
  onLogin,
  onLogout,
}) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="topbar-brand">
          QuantSolve Engine
        </Link>

        <nav className="topbar-nav">
          <Link to="/app" className="topbar-link">
            Solver
          </Link>

          {user ? (
            <>
              <span className="topbar-user">{user.displayName || user.email}</span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onLogout}
                disabled={authActionLoading}
              >
                Logout
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onLogin}
              disabled={authLoading || authActionLoading}
            >
              {authActionLoading ? "Signing in..." : "Login with Google"}
            </button>
          )}
        </nav>
      </div>

      {authError && <p className="topbar-error">{authError}</p>}
    </header>
  );
}
