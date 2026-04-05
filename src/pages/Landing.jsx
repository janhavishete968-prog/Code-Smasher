import { Link } from "react-router-dom";

export default function Landing({ user, authLoading, authActionLoading, authError, onLogin }) {
  return (
    <main className="landing-shell">
      <section className="landing-card">
        <h1>QuantSolve Engine</h1>
        <p>Solve algebraic equations with constraints</p>

        <div className="landing-actions">
          <Link className="btn btn-primary" to="/app">
            Try Solver
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onLogin}
            disabled={authLoading || authActionLoading}
          >
            {authActionLoading ? "Signing in..." : "Login with Google"}
          </button>
        </div>

        {user && <p className="landing-user">Signed in as {user.email || user.displayName}</p>}
        {authError && <p className="landing-error">{authError}</p>}
      </section>
    </main>
  );
}
