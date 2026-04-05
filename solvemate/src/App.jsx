import React, { useState } from 'react';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [auth, setAuth] = useState({ user: "", pass: "" });
  const [view, setView] = useState("engine");
  const [query, setQuery] = useState("");
  const [rules, setRules] = useState([]);
  const [history, setHistory] = useState([]);
  const [currentResult, setCurrentResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const API_BASE = "http://localhost:5000/api";

  const handleLogout = () => {
    setIsLoggedIn(false);
    setAuth({ user: "", pass: "" });
    setCurrentResult(null);
  };

  const validateLogin = (e) => {
    e.preventDefault();
    const { user, pass } = auth;
    
    // Strict Username: 12 chars
    if (user.length !== 12) return alert("ACCESS DENIED: ID must be exactly 12 characters.");
    
    // Strict Password: 8 chars, 1 Capital, 1 @
    if (pass.length !== 8) return alert("ACCESS DENIED: Key must be exactly 8 characters.");
    if (!/[A-Z]/.test(pass)) return alert("ACCESS DENIED: Missing Capital Letter.");
    if (!pass.includes('@')) return alert("ACCESS DENIED: Missing '@' symbol.");

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
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f18] font-mono p-4">
      <form onSubmit={validateLogin} className="bg-[#161b22] p-10 border border-emerald-500/30 rounded-xl w-full max-w-md shadow-2xl">
        <h1 className="text-white text-center text-xl font-black mb-8 tracking-[0.2em]">QS_STRICT_VAULT</h1>
        <div className="space-y-4">
          <input className="w-full bg-black border border-slate-800 p-4 text-emerald-500 text-sm outline-none" placeholder="ID (12 CHARS)" maxLength={12} onChange={e => setAuth({...auth, user: e.target.value})} required />
          <input type="password" className="w-full bg-black border border-slate-800 p-4 text-emerald-500 text-sm outline-none" placeholder="KEY (8 CHARS, CAP, @)" maxLength={8} onChange={e => setAuth({...auth, pass: e.target.value})} required />
          <button className="w-full bg-emerald-600 py-4 font-bold text-white hover:bg-emerald-500 uppercase text-xs tracking-widest transition-all">Authorize Session</button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0f18] text-slate-300 font-mono p-4 md:p-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        
        {/* Top Header */}
        <div className="flex justify-between items-center bg-[#161b22] p-5 border border-slate-800 rounded-lg">
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-500 uppercase font-black">Active Operator</span>
            <span className="text-xs font-bold text-emerald-500 tracking-tighter">{auth.user}</span>
          </div>
          
          <div className="flex gap-4 items-center">
            <div className="flex bg-black p-1 rounded border border-slate-800">
              <button onClick={() => setView("engine")} className={`px-6 py-2 text-[10px] font-bold ${view === 'engine' ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}>ENGINE</button>
              <button onClick={() => { setView("history"); fetch(`${API_BASE}/history`).then(r=>r.json()).then(setHistory); }} className={`px-6 py-2 text-[10px] font-bold ${view === 'history' ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}>LEDGER</button>
            </div>
            <button onClick={handleLogout} className="bg-red-900/10 border border-red-900/40 px-4 py-2 text-[10px] text-red-500 font-bold hover:bg-red-900/30 transition-all uppercase">Logout</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Rules Sidebar */}
          <div className="bg-[#161b22] border border-slate-800 p-6 rounded-lg h-fit">
            <h3 className="text-[10px] text-slate-500 mb-4 uppercase font-bold border-b border-slate-800 pb-2">Logic Limits</h3>
            {rules.map((rule, i) => (
              <div key={i} className="flex gap-2 mb-3">
                <input placeholder="var" className="w-10 bg-black border border-slate-800 p-2 text-[10px] text-emerald-400 outline-none" onChange={e => updateRule(i, 'variable', e.target.value)} />
                <select className="bg-black border border-slate-800 text-[10px] outline-none" onChange={e => updateRule(i, 'type', e.target.value)}>
                  <option value="min">≥</option>
                  <option value="max">≤</option>
                </select>
                <input type="number" className="w-14 bg-black border border-slate-800 p-2 text-[10px] outline-none" onChange={e => updateRule(i, 'value', e.target.value)} />
              </div>
            ))}
            <button onClick={addRule} className="w-full mt-2 border border-dashed border-slate-800 py-3 text-[9px] hover:bg-emerald-900/10 font-bold transition-all uppercase">+ Set Rule</button>
          </div>

          {/* Console Area */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-[#161b22] border border-slate-800 p-6 rounded-lg">
              <div className="flex gap-4">
                <input className="flex-1 bg-black border border-slate-700 p-4 text-emerald-400 font-bold outline-none" placeholder="ENTER_FORMULA (e.g. 10x + 20y = 100)" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSolve()} />
                <button onClick={handleSolve} disabled={loading} className="bg-emerald-600 px-10 font-black text-xs text-white uppercase hover:bg-emerald-500 transition-all">Compute</button>
              </div>
            </div>

            <div className="bg-black border border-slate-900 p-8 rounded min-h-[450px]">
              {view === "engine" ? (
                currentResult ? (
                  <div>
                    <h4 className="text-[10px] text-slate-600 mb-4 uppercase tracking-[0.4em]">Matrix Output ({currentResult.count})</h4>
                    <div className="text-emerald-500 text-xs leading-relaxed break-all font-mono p-4 bg-[#0d1117] border border-slate-800 rounded">
                      {currentResult.output}
                    </div>
                  </div>
                ) : <div className="h-[300px] flex items-center justify-center opacity-10 uppercase tracking-[1em] text-[10px]">System_Idle</div>
              ) : (
                <div className="space-y-6">
                  <h3 className="text-[10px] text-slate-700 font-bold mb-6 tracking-widest uppercase border-b border-slate-900 pb-2">Master Ledger</h3>
                  {history.map(item => (
                    <div key={item.id} className="border-l-2 border-emerald-900 pl-4 py-3 bg-[#161b22]/20 hover:bg-[#161b22]/40 transition-all">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-emerald-500 font-bold text-sm">{item.input}</p>
                        {/* TIMESTAMP WITH AM/PM DISPLAY */}
                        <span className="text-[9px] text-slate-500 font-bold tracking-tighter uppercase">{item.timestamp}</span>
                      </div>
                      <p className="text-emerald-900 text-[10px] break-all leading-tight mt-3 font-mono">{item.output}</p>
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