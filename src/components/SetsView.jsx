import React from 'react';

export default function SetsView({ firstSets, followSets, grammar }) {
  if (!firstSets || !grammar) {
    return <div className="empty-state"><div className="icon">📊</div><h3>No Analysis Yet</h3><p>Enter a grammar and click "Analyze Grammar" to compute FIRST and FOLLOW sets.</p></div>;
  }

  const renderSet = (label, sets, symbols) => (
    <div>
      <h3 style={{ fontSize: '.95rem', color: 'var(--accent-hover)', marginBottom: '.75rem' }}>{label}</h3>
      <div className="sets-grid">
        {symbols.map(sym => {
          const values = sets.get(sym);
          if (!values || values.size === 0) return null;
          return (
            <div key={sym} className="set-card">
              <h4>{label.split(' ')[0]}({sym})</h4>
              <div className="set-values">
                {[...values].map((v, i) => <span key={i}>{v}</span>)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      {renderSet('FIRST Sets', firstSets, [...grammar.nonTerminals, ...grammar.terminals])}
      <div style={{ height: '1.5rem' }} />
      {followSets && renderSet('FOLLOW Sets', followSets, grammar.nonTerminals)}
    </div>
  );
}
