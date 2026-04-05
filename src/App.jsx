import React, { useState, useEffect } from "react";
import axios from "axios";
import History from "./components/History";
import "./index.css";

const App = () => {
  const [input, setInput] = useState("");
  const [constraints, setConstraints] = useState({});
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  const fetchHistory = async () => {
    const res = await axios.get("http://localhost:5000/api/history");
    setHistory(res.data);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSubmit = async () => {
    try {
      const res = await axios.post("http://localhost:5000/api/solve", { input, constraints });
      setResult(res.data.solution);
      fetchHistory();
    } catch (err) {
      setResult(err.response?.data?.error || "Error solving equation");
    }
  };

  const handleConstraintChange = (variable, key, value) => {
    setConstraints(prev => ({
      ...prev,
      [variable]: { ...prev[variable], [key]: Number(value) }
    }));
  };

  return (
    <div className="app-container">
      <h1>Equation Solver</h1>
      <div className="input-section">
        <input
          type="text"
          placeholder="Enter equation, e.g., 10x + 20y = 100"
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <button onClick={handleSubmit}>Solve</button>
      </div>

      {result && (
        <div className="result-section">
          <h2>Results:</h2>
          {Array.isArray(result) ? (
            result.map((res, i) => (
              <div key={i} className="result-item">{JSON.stringify(res)}</div>
            ))
          ) : (
            <div>{result}</div>
          )}
        </div>
      )}

      <History history={history} handleConstraintChange={handleConstraintChange} />
    </div>
  );
};

export default App;