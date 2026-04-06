import React, { useState, useEffect } from 'react';
import './App.css';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [auth, setAuth] = useState({ user: "", pass: "" });
  const [accountExists, setAccountExists] = useState(false);
  const [savedAccount, setSavedAccount] = useState({ user: "", pass: "" });
  const [view, setView] = useState("engine");
  const [query, setQuery] = useState("");
  const [rules, setRules] = useState([]);
  const [history, setHistory] = useState([]);
  const [currentResult, setCurrentResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const API_BASE = "http://localhost:5000/api";

  useEffect(() => {
    const saved = localStorage.getItem('solvemateAccount');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.user && parsed.pass) {
          setSavedAccount(parsed);
          setAccountExists(true);
        }
      } catch (err) {
        console.warn('Invalid saved account state');
      }
    }
  }, []);

  const handleLogout = () => {
    setIsLoggedIn(false);
    setAuth({ user: "", pass: "" });
    setCurrentResult(null);
  };

  const validateLogin = (e, mode = 'unlock') => {
    e.preventDefault();
    const { user, pass } = auth;
    
    // Strict Username: 12 chars
    if (user.length !== 12) return alert("ACCESS DENIED: ID must be exactly 12 characters.");
    
    // Strict Password: 8 chars, 1 Capital, 1 @
    if (pass.length !== 8) return alert("ACCESS DENIED: Key must be exactly 8 characters.");
    if (!/[A-Z]/.test(pass)) return alert("ACCESS DENIED: Missing Capital Letter.");
    if (!pass.includes('@')) return alert("ACCESS DENIED: Missing '@' symbol.");

    if (mode === 'signin') {
      if (accountExists) {
        if (!window.confirm('An account already exists. Overwrite it with this ID and Key?')) {
          return;
        }
      }
      const saved = { user, pass };
      localStorage.setItem('solvemateAccount', JSON.stringify(saved));
      setSavedAccount(saved);
      setAccountExists(true);
      alert(accountExists ? 'Account replaced successfully. Please use Unlock next time.' : 'Account created successfully. Please use Unlock next time.');
      setIsLoggedIn(true);
      return;
    }

    if (!accountExists) {
      return alert('No saved account found. Please sign in first.');
    }

    if (user !== savedAccount.user || pass !== savedAccount.pass) {
      return alert('Invalid ID or Key. Please try again.');
    }

    setIsLoggedIn(true);
  };

  const addRule = () => setRules([...rules, { variable: '', type: 'min', value: 0 }]);
  const updateRule = (i, field, val) => {
    const newRules = [...rules];
    newRules[i][field] = val;
    setRules(newRules);
  };

  const handleSolve = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equation: query, rules }),
      });
      const data = await response.json();
      setCurrentResult(data);
      setView("engine");
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  };

  if (!isLoggedIn) return (
    <div className="min-h-screen flex items-center justify-center handmade-background p-4">
      <div className="handmade-panel w-full max-w-md p-8 rounded-[28px] border handmade-border shadow-handmade">
        <h1 className="text-[#4b3b2c] text-center text-3xl font-semibold mb-6 handmade-heading">Welcome Back</h1>
        <p className="text-sm text-[#6b5a4a] mb-8 text-center">Enter your access details to continue working with the solver.</p>
        <div className="space-y-4">
          <input className="handmade-input w-full p-4 text-[#4a3a2c] placeholder-[#8f7b65] rounded-lg" placeholder="ID (12 characters)" maxLength={12} value={auth.user} onChange={e => setAuth({...auth, user: e.target.value})} required />
          <input type="password" className="handmade-input w-full p-4 text-[#4a3a2c] placeholder-[#8f7b65] rounded-lg" placeholder="Key (8 chars, include @)" maxLength={8} value={auth.pass} onChange={e => setAuth({...auth, pass: e.target.value})} required />
          <div className="grid grid-cols-2 gap-4">
            <button type="button" onClick={(e) => validateLogin(e, 'unlock')} className="handmade-button w-full py-4 text-sm font-semibold uppercase tracking-[0.18em]">Unlock</button>
            <button
              type="button"
              onClick={(e) => validateLogin(e, 'signin')}
              className="handmade-button w-full py-4 text-sm font-semibold uppercase tracking-[0.18em]"
            >
              Sign In
            </button>
          </div>
          <p className="text-center text-xs text-[#8d7358] mt-3">
            {accountExists
              ? 'Returning user? Use Unlock to sign in with your existing account.'
              : 'New user? Choose Sign In to register and unlock access.'}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen handmade-background text-[#4b3b2c] font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        
        {/* Top Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center handmade-panel p-6 handmade-border rounded-[28px] gap-4 shadow-handmade">
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.18em] text-[#6f80a8]">QuantSolve Dashboard</span>
            <span className="text-2xl font-semibold handmade-heading text-slate-900">{auth.user || 'Operator'}</span>
            <p className="text-sm text-slate-600 max-w-xl">Financial algebra meets trading logic — build rules, solve allocations, and review outcome patterns.</p>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex rounded-full border border-[#d7b88a] bg-[#fff7ed] overflow-hidden text-sm shadow-sm">
              <button onClick={() => setView("engine")} className={`px-6 py-3 ${view === 'engine' ? 'bg-[#c99d6b] text-white' : 'text-[#7d664f]'}`}>Solver</button>
              <button onClick={() => { setView("history"); fetch(`${API_BASE}/history`).then(r=>r.json()).then(setHistory); }} className={`px-6 py-3 ${view === 'history' ? 'bg-[#c99d6b] text-white' : 'text-[#7d664f]'}`}>History</button>
            </div>
            <button onClick={handleLogout} className="handmade-button py-3 px-5 text-sm font-semibold uppercase tracking-[0.18em]">Sign Out</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Rules Sidebar */}
          <div className="handmade-panel handmade-border p-6 rounded-[28px] h-fit">
            <h3 className="text-sm text-[#8d7358] mb-4 uppercase font-semibold border-b border-[#e4d3b8] pb-2">Constraints</h3>
            {rules.map((rule, i) => (
              <div key={i} className="flex gap-2 mb-3">
                <input placeholder="var" className="handmade-input w-12 p-3 text-sm rounded-lg" onChange={e => updateRule(i, 'variable', e.target.value)} />
                <select className="handmade-input p-3 text-sm rounded-lg" onChange={e => updateRule(i, 'type', e.target.value)}>
                  <option value="min">≥</option>
                  <option value="max">≤</option>
                </select>
                <input type="number" className="handmade-input w-16 p-3 text-sm rounded-lg" onChange={e => updateRule(i, 'value', e.target.value)} />
              </div>
            ))}
            <button onClick={addRule} className="w-full border border-dashed border-[#b89b75] py-3 text-sm text-[#7d6a55] hover:bg-[#fff3e8] rounded-lg transition-all">+ add constraint</button>
          </div>

          {/* Console Area */}
          <div className="lg:col-span-3 space-y-6">
            <div className="handmade-panel handmade-border p-6 rounded-[28px] bg-slate-950 text-slate-100">
              <div className="flex flex-col lg:flex-row gap-4">
                <input className="handmade-input flex-1 p-4 text-sm rounded-[22px] bg-slate-900 text-slate-100 border-slate-700" placeholder="Example: 10x + 20y = 100" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSolve()} />
                <button onClick={handleSolve} disabled={loading} className="handmade-button px-10 py-4 text-sm font-semibold uppercase tracking-[0.18em]">Solve it</button>
              </div>
            </div>

            <div className="handmade-panel handmade-border p-8 rounded-[28px] min-h-[450px] bg-slate-50">
              {view === "engine" ? (
                currentResult ? (
                  <div>
                    <div className="flex items-center justify-between gap-4 mb-6">
                      <div>
                        <h4 className="text-xs text-slate-500 mb-2 uppercase tracking-[0.25em]">Result</h4>
                        <div className="text-lg font-semibold text-slate-900">Solve output</div>
                      </div>
                      <div className="rounded-full bg-slate-100 px-4 py-2 text-xs uppercase tracking-[0.24em] text-slate-600">Financial</div>
                    </div>
                    {/* <div className="rounded-3xl bg-white border border-slate-200 p-6 text-sm leading-relaxed text-slate-800">
                      {currentResult.output}
                    </div> */}
                    <div className="rounded-3xl bg-white border border-slate-200 p-6 text-sm text-slate-800">

  <div className="mb-4 font-semibold">
    {currentResult.message}
  </div>

  {currentResult.solutions?.map((row, i) => (
    <div key={i}>
      {Object.entries(row).map(([k, v]) => (
        <span key={k} className="mr-3">
          {k} = {v}
        </span>
      ))}
    </div>
  ))}

</div>
                    <div className="mt-6 text-sm text-slate-500">Perfect combinations shown below.</div>
                  </div>
                ) : (
                  <div className="h-[300px] flex flex-col items-center justify-center text-slate-500 opacity-90 uppercase tracking-[0.3em] text-xs">
                    waiting for your problem
                  </div>
                )
              ) : (
                <div className="space-y-6">
                  <h3 className="text-sm text-[#8d7358] font-semibold mb-6 tracking-[0.2em] uppercase border-b border-[#e4d3b8] pb-2">Activity Log</h3>
                  {history.map(item => (
                    <div key={item.id} className="rounded-3xl border-l-4 border-[#c69f74] bg-[#fff5e8] p-4 hover:bg-[#fff6ef] transition-all">
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-2 mb-2">
                        <p className="text-[#5f4a39] font-semibold text-sm">{item.input}</p>
                        <span className="text-[11px] text-[#8d7358] uppercase tracking-[0.2em]">{item.timestamp}</span>
                      </div>
                      <p className="text-[#6c553f] text-sm leading-relaxed whitespace-pre-wrap">{item.output}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;