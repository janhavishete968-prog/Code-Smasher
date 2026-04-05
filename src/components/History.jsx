import React from "react";

const History = ({ history, handleConstraintChange }) => {
  return (
    <div className="history-section">
      <h2>History</h2>
      {history.length === 0 ? <p>No history yet</p> :
        history.map(entry => (
          <div key={entry.id} className="history-item">
            <div className="history-input">{entry.input}</div>
            <div className="history-solution">
              {Array.isArray(entry.solution)
                ? entry.solution.map((res, i) => <div key={i}>{JSON.stringify(res)}</div>)
                : <div>{entry.solution}</div>
              }
            </div>
          </div>
        ))
      }
    </div>
  );
};

export default History;