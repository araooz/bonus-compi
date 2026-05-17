import React, { useState, useEffect, useRef, useCallback } from 'react';

export default function SimulationView({ steps }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef(null);
  const tableRef = useRef(null);

  useEffect(() => { setCurrentStep(0); setPlaying(false); }, [steps]);

  useEffect(() => {
    if (playing && steps && currentStep < steps.length - 1) {
      intervalRef.current = setTimeout(() => setCurrentStep(s => s + 1), 600);
      return () => clearTimeout(intervalRef.current);
    } else if (currentStep >= (steps?.length || 0) - 1) {
      setPlaying(false);
    }
  }, [playing, currentStep, steps]);

  useEffect(() => {
    if (tableRef.current) {
      const row = tableRef.current.querySelector(`tr[data-step="${currentStep}"]`);
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentStep]);

  if (!steps || steps.length === 0) {
    return <div className="empty-state"><div className="icon">▶️</div><h3>No Simulation</h3><p>Enter a string and click "Parse String" to see the step-by-step trace.</p></div>;
  }

  const lastStep = steps[steps.length - 1];
  const accepted = lastStep.action === 'ACCEPT';
  const errored = lastStep.action.includes('ERROR');

  return (
    <div>
      <div className="sim-controls">
        <button className="btn btn-sm btn-secondary" onClick={() => { setCurrentStep(0); setPlaying(false); }}>⏮</button>
        <button className="btn btn-sm btn-secondary" onClick={() => setCurrentStep(s => Math.max(0, s - 1))} disabled={currentStep === 0}>⏪</button>
        <button className="btn btn-sm btn-primary" onClick={() => setPlaying(p => !p)}>{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button className="btn btn-sm btn-secondary" onClick={() => setCurrentStep(s => Math.min(steps.length - 1, s + 1))} disabled={currentStep >= steps.length - 1}>⏩</button>
        <button className="btn btn-sm btn-secondary" onClick={() => { setCurrentStep(steps.length - 1); setPlaying(false); }}>⏭</button>
        <span className="step-label">Step {currentStep + 1} / {steps.length}</span>
        {accepted && <span className="badge badge-success">✓ Accepted</span>}
        {errored && <span className="badge badge-error">✗ Rejected</span>}
      </div>
      <div className="parse-table-wrapper" ref={tableRef} style={{ maxHeight: '60vh' }}>
        <table className="trace-table">
          <thead>
            <tr><th>#</th><th>Stack</th><th>Input</th><th>Action</th></tr>
          </thead>
          <tbody>
            {steps.map((s, i) => (
              <tr key={i} data-step={i}
                className={`${i === currentStep ? 'current' : ''} ${s.action === 'ACCEPT' ? 'accept' : ''} ${s.action.includes('ERROR') ? 'error' : ''}`}
                style={{ opacity: i <= currentStep ? 1 : 0.3 }}>
                <td>{s.step}</td>
                <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.stack}</td>
                <td>{s.input}</td>
                <td>{s.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
