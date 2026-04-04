import React, { useState } from "react";
import History from "./components/History";

const App = () => {
  // login state
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // login inputs
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // solver states
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const handleLogin = () => {
    if (username && password) {
      setIsLoggedIn(true); // go to home page
    } else {
      alert("Enter username and password");
    }
  };

  const handleSolve = () => {
    if (!input) return;

    const now = new Date();

    const newEntry = {
      id: history.length + 1,
      input: input,
      solution: "Solved",
      timestamp: now.toLocaleString(),
    };

    setHistory([newEntry, ...history]);
    setInput("");
  };

  // 🔐 LOGIN PAGE
  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <h1>Login</h1>

        <input
          type="text"
          placeholder="Username"
          className="login-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="login-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="btn" onClick={handleLogin}>
          Login
        </button>
      </div>
    );
  }

  // 🏠 HOME PAGE (your existing UI)
  return (
    <div>
      <div className="maindiv">
        <h1>Equation Solver</h1>

        <textarea
          className="placeholder"
          placeholder="Enter your equation (e.g 10x+20y=100)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />

        <div className="btns">
          <button className="btn" onClick={handleSolve}>
            Solve
          </button>

          <button
            className="btn"
            onClick={() => setShowHistory(!showHistory)}
          >
            View history
          </button>
        </div>
      </div>

      {showHistory && <History history={history} />}
    </div>
  );
};

export default App;