function formatTimestamp(value) {
  if (!value) {
    return "Just now";
  }

  if (typeof value.toDate === "function") {
    return value.toDate().toLocaleString();
  }

  if (value instanceof Date) {
    return value.toLocaleString();
  }

  return "Pending";
}

export default function History({ entries, isLoading, error, isLoggedIn }) {
  return (
    <section className="history-panel">
      <div className="history-head">
        <h2>Your History</h2>
        <p>Saved equations for the signed-in user. Local fallback is used when cloud sync fails.</p>
      </div>

      {!isLoggedIn && <p className="history-empty">Login with Google to save and view history.</p>}

      {isLoggedIn && isLoading && <p className="history-empty">Loading history...</p>}

      {isLoggedIn && error && <p className="history-error">{error}</p>}

      {isLoggedIn && !isLoading && !error && entries.length === 0 && (
        <p className="history-empty">No history yet. Solve an equation to create your first entry.</p>
      )}

      {isLoggedIn && entries.length > 0 && (
        <ul className="history-list">
          {entries.map((entry) => (
            <li key={entry.id || `${entry.equation}-${entry.createdAt || "pending"}`}>
              <p>{entry.equation}</p>
              <span>
                {formatTimestamp(entry.createdAt)}
                {entry.isLocal ? " - local" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}