import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import "../App.css";
import History from "../components/History";
import Navbar from "../components/Navbar";
import { db, isFirebaseConfigured } from "../firebase";
import { parseEquation, solvePortfolio } from "../utils/solver";

const EXAMPLE_EQUATION = "10x + 20y = 100";
const EXAMPLE_CONSTRAINTS = "x >= 0, y >= 0";
const MAX_UI_ROWS = 500;
const LOCAL_HISTORY_LIMIT = 25;

const DEMO_SCENARIOS = [
  {
    id: "basic-1",
    title: "Basic Single Asset",
    equation: "50x = 200",
    constraints: "x >= 0",
    expectation: "Returns x = 4",
  },
  {
    id: "two-var",
    title: "Two Asset Allocation",
    equation: "10x + 20y = 100",
    constraints: "x >= 0, y >= 0",
    expectation: "Shows all non-negative integer allocations",
  },
  {
    id: "many-var",
    title: "Multi-Asset Portfolio",
    equation: "10a + 15b + 20c + 50d + 5e = 1000",
    constraints: "a >= 0, b >= 0, c >= 0, d >= 0, e >= 0",
    expectation: "Finds valid 5-asset combinations",
  },
  {
    id: "rules",
    title: "Rules + Constraints",
    equation: "10x + 20y + 5z = 100",
    constraints: "x > 5, y < 3, z >= 0",
    expectation: "Applies rule engine after solving",
  },
  {
    id: "even-rule",
    title: "Even Rule",
    equation: "10a + 5c = 50",
    constraints: "a >= 0, c must be even",
    expectation: "Enforces c must be even",
  },
  {
    id: "brackets",
    title: "Brackets + Priority",
    equation: "((10x + 20y) * 2) + 5z = 500",
    constraints: "x >= 0, y >= 0, z >= 0",
    expectation: "Respects BODMAS/PEMDAS",
  },
  {
    id: "impossible",
    title: "Impossible Case",
    equation: "2x + 4y = 3",
    constraints: "x >= 0, y >= 0",
    expectation: "Shows no whole-number solution",
  },
  {
    id: "infinite",
    title: "Infinity Trap",
    equation: "x + y = 100",
    constraints: "",
    expectation: "Shows market limits warning",
  },
];

function assetLabel(index) {
  return `Asset ${String.fromCharCode(65 + index)}`;
}

function getAssetEntries(parsed) {
  return parsed.variables.map((variableName, index) => ({
    variableName,
    label: assetLabel(index),
    coefficient: parsed.coeffs[variableName],
  }));
}

function buildAllocationText(row, assetEntries) {
  return assetEntries
    .map((asset) => `Buy ${row[asset.variableName]} units of ${asset.label}`)
    .join(", ");
}

function isRecommendedRow(row, recommended, variables) {
  if (!recommended) {
    return false;
  }

  return variables.every((variableName) => row[variableName] === recommended[variableName]);
}

function createRuleRow(variables) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    variable: variables[0] || "",
    type: "compare",
    operator: ">=",
    value: 0,
  };
}

function getEquationVariables(equationText) {
  try {
    return parseEquation(equationText).variables;
  } catch {
    return [];
  }
}

function buildCombinedConstraints(manualConstraints, ruleRows) {
  const manual = (manualConstraints || "").trim();
  const structured = ruleRows
    .filter((row) => row.variable)
    .map((row) => {
      if (row.type === "even") {
        return `${row.variable} must be even`;
      }

      const numericValue = Number.isFinite(Number(row.value)) ? Number(row.value) : 0;
      return `${row.variable} ${row.operator} ${numericValue}`;
    });

  return [manual, ...structured].filter(Boolean).join(", ");
}

function getTimestampMs(value) {
  if (!value) {
    return 0;
  }

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function getLocalHistoryKey(uid) {
  return `quantsolve-history-${uid}`;
}

function loadLocalHistory(uid) {
  if (!uid || typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getLocalHistoryKey(uid));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((row) => ({
      ...row,
      createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
    }));
  } catch {
    return [];
  }
}

function saveLocalHistory(uid, rows) {
  if (!uid || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getLocalHistoryKey(uid), JSON.stringify(rows));
  } catch {
    // Ignore storage failures and keep app behavior intact.
  }
}

function appendLocalHistory(uid, equationText) {
  const current = loadLocalHistory(uid);
  const next = [
    {
      id: `local-${Date.now()}`,
      uid,
      equation: equationText,
      createdAt: new Date(),
      isLocal: true,
    },
    ...current,
  ].slice(0, LOCAL_HISTORY_LIMIT);

  saveLocalHistory(uid, next);
  return next;
}

export default function App({
  user,
  authLoading,
  authActionLoading,
  authError,
  onLogin,
  onLogout,
}) {
  const [equation, setEquation] = useState(EXAMPLE_EQUATION);
  const [constraints, setConstraints] = useState(EXAMPLE_CONSTRAINTS);
  const [ruleRows, setRuleRows] = useState([]);
  const [error, setError] = useState("");
  const [isSolving, setIsSolving] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [activeScenario, setActiveScenario] = useState("");
  const [result, setResult] = useState(null);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const equationVariables = useMemo(() => getEquationVariables(equation), [equation]);
  const compiledRulesPreview = useMemo(
    () => buildCombinedConstraints(constraints, ruleRows),
    [constraints, ruleRows],
  );

  const fetchHistory = async (activeUser) => {
    if (!activeUser) {
      setHistoryEntries([]);
      setIsHistoryLoading(false);
      setHistoryError("");
      return;
    }

    if (!db || !isFirebaseConfigured) {
      const localRows = loadLocalHistory(activeUser.uid);
      localRows.sort((left, right) => getTimestampMs(right.createdAt) - getTimestampMs(left.createdAt));
      setHistoryEntries(localRows);
      setIsHistoryLoading(false);
      setHistoryError(
        localRows.length
          ? "Cloud history unavailable. Showing local history on this device."
          : "Cloud history unavailable. Configure Firestore to enable synced history.",
      );
      return;
    }

    setIsHistoryLoading(true);
    setHistoryError("");

    try {
      const historyQuery = query(
        collection(db, "history"),
        where("uid", "==", activeUser.uid),
      );

      const snapshot = await getDocs(historyQuery);
      const rows = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      rows.sort((left, right) => getTimestampMs(right.createdAt) - getTimestampMs(left.createdAt));
      setHistoryEntries(rows);
    } catch (historyReadError) {
      const localRows = loadLocalHistory(activeUser.uid);
      localRows.sort((left, right) => getTimestampMs(right.createdAt) - getTimestampMs(left.createdAt));
      setHistoryEntries(localRows);

      if (historyReadError?.code === "permission-denied") {
        setHistoryError("Firestore permission denied. Showing local history on this device.");
      } else {
        setHistoryError(
          localRows.length
            ? "Cloud history unavailable. Showing local history on this device."
            : "Could not load history. Check Firestore setup and rules.",
        );
      }
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    setRuleRows((previous) => {
      if (!previous.length) {
        return previous;
      }

      let changed = false;
      const next = previous.map((row) => {
        if (equationVariables.includes(row.variable)) {
          return row;
        }

        changed = true;
        return {
          ...row,
          variable: equationVariables[0] || "",
        };
      });

      return changed ? next : previous;
    });
  }, [equationVariables]);

  useEffect(() => {
    fetchHistory(user);
  }, [user]);

  const solveWithInputs = async (equationText, constraintsText, structuredRules = ruleRows) => {
    setError("");
    setIsSolving(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 160));
      const combinedConstraints = buildCombinedConstraints(constraintsText, structuredRules);
      const solved = solvePortfolio(equationText, combinedConstraints);
      setResult(solved);

      if (user) {
        let cloudSaved = false;

        if (db && isFirebaseConfigured) {
          try {
            await addDoc(collection(db, "history"), {
              uid: user.uid,
              equation: equationText,
              createdAt: serverTimestamp(),
            });
            cloudSaved = true;
            await fetchHistory(user);
          } catch (historyWriteError) {
            if (historyWriteError?.code === "permission-denied") {
              setHistoryError(
                "Firestore permission denied. Saved to local history on this device.",
              );
            }
          }
        }

        if (!cloudSaved) {
          const localRows = appendLocalHistory(user.uid, equationText);
          setHistoryEntries(localRows);
          if (!historyError) {
            setHistoryError("Saved to local history on this device.");
          }
        }
      }
    } catch (solveError) {
      setResult(null);
      setError(solveError?.message || "Unexpected error while solving.");
    } finally {
      setIsSolving(false);
    }
  };

  const handleSolve = () => solveWithInputs(equation, constraints);

  const handleExample = () => {
    setEquation(EXAMPLE_EQUATION);
    setConstraints(EXAMPLE_CONSTRAINTS);
    setRuleRows([]);
    setError("");
    setResult(null);
    setActiveScenario("");
  };

  const handleClear = () => {
    setEquation("");
    setConstraints("");
    setRuleRows([]);
    setError("");
    setResult(null);
    setActiveScenario("");
  };

  const handleScenarioRun = (scenario) => {
    const scenarioRules = [];
    setEquation(scenario.equation);
    setConstraints(scenario.constraints);
    setRuleRows(scenarioRules);
    setActiveScenario(scenario.id);
    solveWithInputs(scenario.equation, scenario.constraints, scenarioRules);
  };

  const handleEquationChange = (event) => {
    setEquation(event.target.value);
    setActiveScenario("");
  };

  const handleConstraintsChange = (event) => {
    setConstraints(event.target.value);
    setActiveScenario("");
  };

  const handleAddRule = () => {
    if (!equationVariables.length) {
      return;
    }

    setRuleRows((previous) => [...previous, createRuleRow(equationVariables)]);
  };

  const handleRemoveRule = (rowId) => {
    setRuleRows((previous) => previous.filter((row) => row.id !== rowId));
  };

  const handleRuleChange = (rowId, patch) => {
    setRuleRows((previous) =>
      previous.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        const next = { ...row, ...patch };
        if (patch.type === "even") {
          next.operator = ">=";
          next.value = 0;
        }

        return next;
      }),
    );
  };

  const assetEntries = result ? getAssetEntries(result.parsed) : [];
  const visibleRows = result ? result.rows.slice(0, MAX_UI_ROWS) : [];
  const isUiTrimmed = result ? result.rows.length > MAX_UI_ROWS : false;

  return (
    <>
      <Navbar
        user={user}
        authLoading={authLoading}
        authActionLoading={authActionLoading}
        authError={authError}
        onLogin={onLogin}
        onLogout={onLogout}
      />

      <main className="page-shell">
      <section className="dashboard-card">
        <header className="hero-block">
          <h1>QuantSolve - The Algebraic Parser and Equation Engine</h1>
          <p>
            Enter finance equations, parse algebra from raw text, and discover
            whole-number portfolio combinations with zero leftover budget.
          </p>
          <span className="mvp-note">
            Trading dashboard: parser + rule engine + whole-number solver
          </span>
        </header>

        <section className="input-grid">
          <div className="field-wrap">
            <label htmlFor="equation">Equation Input</label>
            <input
              id="equation"
              className="text-field"
              value={equation}
              onChange={handleEquationChange}
              placeholder="150a + 100b + 50c + 10d = 5000"
            />
          </div>

          <div className="field-wrap">
            <label htmlFor="constraints">Market Limits / Rules (optional)</label>
            <input
              id="constraints"
              className="text-field"
              value={constraints}
              onChange={handleConstraintsChange}
              placeholder="x >= 0, y >= 0, c must be even"
            />
          </div>
        </section>

        <section className="rule-builder">
          <div className="rule-builder-head">
            <h2>Rule Builder</h2>
            <p>
              Add constraints with dropdowns, then solve. These generated rules are merged with
              the text rules above.
            </p>
          </div>

          {equationVariables.length === 0 ? (
            <p className="rule-helper">
              Enter a valid linear equation first to load variables for structured rules.
            </p>
          ) : (
            <>
              {ruleRows.length > 0 ? (
                <div className="rule-list">
                  {ruleRows.map((row) => (
                    <div className="rule-row" key={row.id}>
                      <select
                        className="rule-control"
                        value={row.variable}
                        onChange={(event) =>
                          handleRuleChange(row.id, { variable: event.target.value })
                        }
                        disabled={isSolving}
                      >
                        {equationVariables.map((variableName) => (
                          <option value={variableName} key={`${row.id}-${variableName}`}>
                            {variableName}
                          </option>
                        ))}
                      </select>

                      <select
                        className="rule-control"
                        value={row.type}
                        onChange={(event) => handleRuleChange(row.id, { type: event.target.value })}
                        disabled={isSolving}
                      >
                        <option value="compare">Compare</option>
                        <option value="even">Must be even</option>
                      </select>

                      {row.type === "compare" ? (
                        <>
                          <select
                            className="rule-control"
                            value={row.operator}
                            onChange={(event) =>
                              handleRuleChange(row.id, { operator: event.target.value })
                            }
                            disabled={isSolving}
                          >
                            <option value=">">&gt;</option>
                            <option value=">=">&gt;=</option>
                            <option value="<">&lt;</option>
                            <option value="<=">&lt;=</option>
                            <option value="==">==</option>
                          </select>

                          <input
                            type="number"
                            className="rule-control"
                            value={row.value}
                            onChange={(event) =>
                              handleRuleChange(row.id, { value: event.target.value })
                            }
                            disabled={isSolving}
                          />
                        </>
                      ) : (
                        <>
                          <span className="rule-pill">must</span>
                          <span className="rule-pill">be even</span>
                        </>
                      )}

                      <button
                        type="button"
                        className="btn btn-remove-rule"
                        onClick={() => handleRemoveRule(row.id)}
                        disabled={isSolving}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rule-helper">No structured rules yet. Add one to start filtering.</p>
              )}

              <button
                type="button"
                className="btn btn-add-rule"
                onClick={handleAddRule}
                disabled={isSolving}
              >
                Add Rule
              </button>
            </>
          )}

          <p className="rule-compiled-preview">
            Compiled rules: {compiledRulesPreview || "None"}
          </p>
        </section>

        <div className="action-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSolve}
            disabled={isSolving}
          >
            {isSolving ? "Solving..." : "Solve"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExample}
            disabled={isSolving}
          >
            Autofill Example
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleClear}
            disabled={isSolving}
          >
            Clear
          </button>
          <button
            type="button"
            className="btn btn-tertiary"
            onClick={() => setIsDemoMode((previous) => !previous)}
            disabled={isSolving}
          >
            Demo Mode: {isDemoMode ? "On" : "Off"}
          </button>
        </div>

        <p className="meta-note">
          No eval and no external math libraries are used. Parser and solver are
          implemented manually.
        </p>

        <History
          entries={historyEntries}
          isLoading={authLoading || isHistoryLoading}
          error={historyError}
          isLoggedIn={Boolean(user)}
        />

        {isDemoMode && (
          <section className="demo-panel fade-in">
            <div className="demo-header">
              <h2>Demo Mode</h2>
              <p>Run hackathon-ready scenarios in one click.</p>
            </div>

            <div className="demo-grid">
              {DEMO_SCENARIOS.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  className={`demo-card ${
                    activeScenario === scenario.id ? "demo-card-active" : ""
                  }`}
                  onClick={() => handleScenarioRun(scenario)}
                  disabled={isSolving}
                >
                  <strong>{scenario.title}</strong>
                  <span>Equation: {scenario.equation}</span>
                  <span>Rules: {scenario.constraints || "None"}</span>
                  <span className="demo-expectation">Expected: {scenario.expectation}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {error && <div className="status-panel status-error">{error}</div>}

        {result && (
          <section className="results-zone fade-in">
            <div className="parsed-panel">
              <h2>Parsed Equation</h2>
              <div className="parsed-assets-grid">
                {assetEntries.map((asset) => (
                  <p key={asset.variableName}>
                    {asset.label} ({asset.variableName}) -&gt; ₹{asset.coefficient} per unit
                  </p>
                ))}
              </div>
              <p>Total Budget -&gt; ₹{result.parsed.total}</p>
            </div>

            <div className="status-panel status-info">{result.statusMessage}</div>

            <div className="count-strip">
              <article>
                <h3>{result.totals.beforeConstraints}{result.isTruncated ? "+" : ""}</h3>
                <p>Total solutions</p>
              </article>
              <article>
                <h3>{result.totals.afterConstraints}{result.isTruncated ? "+" : ""}</h3>
                <p>After rules applied</p>
              </article>
              <article>
                <h3>{result.metrics.durationMs} ms</h3>
                <p>{result.metrics.iterations.toLocaleString()} iterations</p>
              </article>
            </div>

            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    {assetEntries.map((asset) => (
                      <th key={asset.variableName}>{asset.label} units</th>
                    ))}
                    <th>Portfolio Interpretation</th>
                    <th>Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={assetEntries.length + 2}>No rows to display</td>
                    </tr>
                  ) : (
                    visibleRows.map((row, index) => {
                      const recommended = isRecommendedRow(
                        row,
                        result.recommended,
                        result.parsed.variables,
                      );

                      return (
                        <tr key={`${result.parsed.variables.map((v) => row[v]).join("-")}-${index}`}>
                          {assetEntries.map((asset) => (
                            <td key={`${asset.variableName}-${index}`}>
                              {row[asset.variableName]}
                            </td>
                          ))}
                          <td>{buildAllocationText(row, assetEntries)}</td>
                          <td>
                            {recommended ? (
                              <span className="pill-recommended">Recommended</span>
                            ) : (
                              <span className="pill-muted">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {isUiTrimmed && (
              <p className="table-limit-note">
                Showing first {MAX_UI_ROWS} rows in the dashboard for performance. Total valid
                allocations remain {result.rows.length.toLocaleString()}.
              </p>
            )}
          </section>
        )}
      </section>
      </main>
    </>
  );
}
