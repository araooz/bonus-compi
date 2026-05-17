import React, { useState, useCallback } from 'react';
import { parseGrammar } from './engines/grammar.js';
import { computeFirstSets, computeFollowSets } from './engines/firstFollow.js';
import { buildLL1Table, simulateLL1 } from './engines/ll1.js';
import { buildLRParser, simulateLR, computeAST } from './engines/lr.js';
import { simulateRecursiveDescent } from './engines/recursiveDescent.js';
import GrammarPanel from './components/GrammarPanel.jsx';
import SetsView from './components/SetsView.jsx';
import TableView from './components/TableView.jsx';
import SimulationView from './components/SimulationView.jsx';
import TreeView from './components/TreeView.jsx';
import AutomatonView from './components/AutomatonView.jsx';
import AITutorView, { AISettingsModal } from './components/AITutorView.jsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function App() {
  // Grammar state
  const [grammarText, setGrammarText] = useState('');
  const [inputStr, setInputStr] = useState('');
  const [parserMethod, setParserMethod] = useState('ll1');
  const [lrMethod, setLrMethod] = useState('slr1');

  // Analysis results
  const [grammar, setGrammar] = useState(null);
  const [firstSets, setFirstSets] = useState(null);
  const [followSets, setFollowSets] = useState(null);
  const [ll1Data, setLl1Data] = useState(null);
  const [lrData, setLrData] = useState(null);
  const [simulationResult, setSimulationResult] = useState(null);
  const [parseTree, setParseTree] = useState(null);
  const [ast, setAst] = useState(null);
  const [errors, setErrors] = useState([]);

  // UI state
  const [activeTab, setActiveTab] = useState('sets');
  const [showAST, setShowAST] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleAnalyze = useCallback(() => {
    setErrors([]);
    setSimulationResult(null);
    setParseTree(null);
    setAst(null);

    const { grammar: g, errors: parseErrors } = parseGrammar(grammarText);
    if (!g) {
      setErrors(parseErrors);
      return;
    }
    setGrammar(g);

    // Compute FIRST and FOLLOW
    const { first } = computeFirstSets(g);
    const { follow } = computeFollowSets(g, first);
    setFirstSets(first);
    setFollowSets(follow);

    if (parserMethod === 'll1' || parserMethod === 'rd') {
      const ll1Result = buildLL1Table(g, first, follow);
      setLl1Data(ll1Result);
      setLrData(null);
    }

    if (parserMethod === 'lr') {
      const result = buildLRParser(g, lrMethod);
      setLrData(result);
      setLl1Data(null);
      if (result.first) setFirstSets(result.first);
      if (result.follow) setFollowSets(result.follow);
    }

    setActiveTab('sets');
  }, [grammarText, parserMethod, lrMethod]);

  const handleSimulate = useCallback(() => {
    if (!grammar) {
      setErrors(['Please analyze a grammar first.']);
      return;
    }
    setErrors([]);

    let result;
    try {
      if (parserMethod === 'rd') {
        result = simulateRecursiveDescent(grammar, inputStr);
      } else if (parserMethod === 'll1') {
        if (!ll1Data) { setErrors(['Please analyze the grammar first.']); return; }
        result = simulateLL1(grammar, ll1Data.table, inputStr);
      } else {
        if (!lrData || !lrData.augGrammar) { setErrors(['Please analyze the grammar first.']); return; }
        result = simulateLR(lrData.augGrammar, lrData.actionTable, lrData.gotoTable, inputStr, grammar);
      }
    } catch (e) {
      setErrors([`Simulation error: ${e.message}`]);
      return;
    }

    setSimulationResult(result);
    setParseTree(result.parseTree);
    if (result.parseTree) setAst(computeAST(result.parseTree));
    setActiveTab('sim');
  }, [grammar, inputStr, parserMethod, ll1Data, lrData]);

  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Parser Analysis Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Grammar: ${grammarText.split('\n').slice(0, 3).join('; ')}...`, 14, 30);
    doc.text(`Method: ${parserMethod === 'lr' ? lrMethod.toUpperCase() : parserMethod.toUpperCase()}`, 14, 36);

    let y = 46;

    // Add simulation trace if available
    if (simulationResult && simulationResult.steps.length > 0) {
      doc.setFontSize(12);
      doc.text('Simulation Trace', 14, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [['#', 'Stack', 'Input', 'Action']],
        body: simulationResult.steps.map(s => [s.step, s.stack.slice(0, 40), s.input.slice(0, 30), s.action.slice(0, 50)]),
        styles: { fontSize: 6, cellPadding: 1 },
        headStyles: { fillColor: [99, 102, 241] },
      });
    }

    doc.save('parser-analysis.pdf');
  }, [grammarText, parserMethod, lrMethod, simulationResult]);

  const conflicts = parserMethod === 'lr' ? (lrData?.conflicts || []) : (ll1Data?.conflicts || []);
  const tabs = [
    { id: 'sets', label: '📊 FIRST / FOLLOW' },
    { id: 'tables', label: '📋 Parsing Tables' },
    { id: 'automaton', label: '🔄 Automaton', show: parserMethod === 'lr' },
    { id: 'sim', label: '▶️ Simulation' },
    { id: 'tree', label: '🌳 Parse Tree' },
    { id: 'ai', label: '🤖 AI Tutor' },
  ].filter(t => t.show !== false);

  return (
    <>
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <h1>The Ultimate Parser</h1>
          <span className="subtitle">Interactive Compiler Theory Visualizer</span>
        </div>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <button className="btn btn-sm btn-secondary" onClick={handleExportPDF}>📄 Export PDF</button>
        </div>
      </header>

      <div className="app-layout">
        <GrammarPanel
          grammarText={grammarText} setGrammarText={setGrammarText}
          inputStr={inputStr} setInputStr={setInputStr}
          grammarInfo={grammar}
          onAnalyze={handleAnalyze} onSimulate={handleSimulate}
          parserMethod={parserMethod} setParserMethod={setParserMethod}
          lrMethod={lrMethod} setLrMethod={setLrMethod}
          onOpenSettings={() => setShowSettings(true)}
        />

        <div className="panel-right">
          {/* Error display */}
          {errors.length > 0 && (
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
              <div className="conflict-banner">
                <h4>⚠️ Errors</h4>
                {errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            </div>
          )}

          <div className="tabs-bar">
            {tabs.map(t => (
              <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
            ))}
          </div>

          <div className="tab-content">
            {activeTab === 'sets' && <SetsView firstSets={firstSets} followSets={followSets} grammar={grammar} />}
            {activeTab === 'tables' && <TableView ll1Data={ll1Data} lrData={lrData} parserMethod={parserMethod} />}
            {activeTab === 'automaton' && <AutomatonView lrData={lrData} />}
            {activeTab === 'sim' && <SimulationView steps={simulationResult?.steps} />}
            {activeTab === 'tree' && (
              <div>
                <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
                  <button className={`btn btn-sm ${!showAST ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowAST(false)}>Parse Tree</button>
                  <button className={`btn btn-sm ${showAST ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowAST(true)}>AST</button>
                </div>
                <TreeView parseTree={parseTree} ast={ast} showAST={showAST} />
              </div>
            )}
            {activeTab === 'ai' && <AITutorView grammar={grammar} simulationResult={simulationResult} conflicts={conflicts} parserMethod={parserMethod} lrMethod={lrMethod} />}
          </div>
        </div>
      </div>

      {showSettings && <AISettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}
