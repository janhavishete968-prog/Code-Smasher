import React from "react";

const History = ({ history }) => {
  return (
    <div className="history-container">
      <h2>Calculation History</h2>

      <table className="history-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Timestamp</th>
            <th>Input</th>
            <th>Solution</th>
          </tr>
        </thead>

        <tbody>
          {history.length === 0 ? (
            <tr>
              <td colSpan="4" style={{ textAlign: "center" }}>
                No history
              </td>
            </tr>
          ) : (
            history.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.timestamp}</td> {/* added timestamp */}
                <td className="mono-text">{item.input}</td>
                <td>
                  <span
                    className={`badge ${
                      item.solution === "Solved" ? "badge-success" : "badge-error"
                    }`}
                  >
                    {item.solution}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default History;