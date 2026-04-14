import React, { useState, useRef, useCallback, useEffect } from 'react';
import { PSOOptimizer, BasicOptimizer, generateRandomTasks, generateRandomVMs } from '../utils/psoLogic';
import {
  Play, Pause, RotateCcw, Activity, Server, Cpu,
  Settings, Info, Zap, SkipForward, BookOpen, X
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import InteractiveNeuralVortex from './ui/interactive-neural-vortex-background.jsx';
import FloatingActionMenu from './ui/floating-action-menu.jsx';

function LabeledSlider({ label, hint, value, min, max, step = 1, onChange }) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <label className="text-sm font-medium text-gray-300">{label}</label>
        <span className="text-sm font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">{value}</span>
      </div>
      {hint && <p className="text-xs text-gray-500 mb-2">{hint}</p>}
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-blue-500 cursor-pointer" />
      <div className="flex justify-between text-[10px] text-gray-600 mt-1">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
}

function TaskEditor({ tasks, onUpdate }) {
  return (
    <div className="max-h-48 overflow-y-auto custom-scrollbar">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-slate-900 text-gray-400">
          <tr>
            <th className="text-left py-2 px-2">#</th>
            <th className="text-left py-2 px-2">Name</th>
            <th className="text-left py-2 px-2">Length (MI)</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t, i) => (
            <tr key={t.id} className="border-t border-slate-800 hover:bg-slate-800/40">
              <td className="py-1.5 px-2 text-gray-500">{i + 1}</td>
              <td className="py-1.5 px-2 text-gray-300">{t.name}</td>
              <td className="py-1.5 px-2">
                <input type="number" min={1000} max={200000} step={1000} value={t.length}
                  onChange={e => {
                    const updated = [...tasks];
                    updated[i] = { ...t, length: Number(e.target.value) };
                    onUpdate(updated);
                  }}
                  className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-blue-400 font-mono focus:outline-none focus:border-blue-500" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VMEditor({ vms, onUpdate }) {
  return (
    <div className="max-h-44 overflow-y-auto custom-scrollbar">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-slate-900 text-gray-400">
          <tr>
            <th className="text-left py-2 px-2">#</th>
            <th className="text-left py-2 px-2">Name</th>
            <th className="text-left py-2 px-2">Speed (MIPS)</th>
          </tr>
        </thead>
        <tbody>
          {vms.map((vm, i) => (
            <tr key={vm.id} className="border-t border-slate-800 hover:bg-slate-800/40">
              <td className="py-1.5 px-2 text-gray-500">{i + 1}</td>
              <td className="py-1.5 px-2 text-gray-300">{vm.name}</td>
              <td className="py-1.5 px-2">
                <input type="number" min={100} max={5000} step={50} value={vm.mips}
                  onChange={e => {
                    const updated = [...vms];
                    updated[i] = { ...vm, mips: Number(e.target.value) };
                    onUpdate(updated);
                  }}
                  className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-green-400 font-mono focus:outline-none focus:border-green-500" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const GLOSSARY = [
  { term: 'Particle', def: 'A single candidate schedule — one complete assignment of all tasks to VMs.' },
  { term: 'Swarm', def: 'All particles together. They share knowledge and collectively find the best schedule.' },
  { term: 'Makespan', def: 'How long it takes for ALL tasks to finish. Lower is better. Defined by the slowest VM.' },
  { term: 'Inertia (w)', def: 'How much a particle keeps moving in its current direction. High = explore. Low = converge.' },
  { term: 'Cognitive (c1)', def: 'How much each particle trusts its own personal best (pBest).' },
  { term: 'Social (c2)', def: 'How much each particle follows the swarm\'s global best (gBest).' },
  { term: 'pBest', def: 'The best schedule a single particle has ever found on its own.' },
  { term: 'gBest', def: 'The best schedule found by ANY particle in the swarm — the final answer.' },
  { term: 'MIPS', def: 'Millions of Instructions Per Second — the processing speed of a VM.' },
  { term: 'Bottleneck VM', def: 'The slowest VM. It defines the total makespan. PSO tries to redistribute tasks away from it.' },
];

function EventEntry({ event, iteration, isLatest }) {
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      className={`p-3 rounded-lg border mb-2 ${isLatest ? 'bg-blue-900/20 border-blue-700/40' : 'bg-slate-800/30 border-slate-700/30'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span>{event.icon}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          event.phase === 'Exploration' ? 'text-yellow-400 bg-yellow-500/10' :
          event.phase === 'Exploitation' ? 'text-blue-400 bg-blue-500/10' :
          event.phase === 'Convergence' ? 'text-purple-400 bg-purple-500/10' :
          'text-green-400 bg-green-500/10'}`}>{event.phase}</span>
        <span className="text-xs text-gray-500 ml-auto">iter {iteration}</span>
      </div>
      <p className="text-xs font-semibold text-gray-200 mb-0.5">{event.headline}</p>
      {isLatest && <p className="text-xs text-gray-400 leading-relaxed">{event.detail}</p>}
    </motion.div>
  );
}

function buildInitialState(pso) {
  return {
    iteration: 0,
    gBest: pso.gBest,
    gBestFitness: pso.gBestFitness,
    history: [...pso.history],
    vms: pso.vms,
    tasks: pso.tasks,
    workload: pso.getVMWorkload(),
    w: pso.w,
    event: pso.lastEvent,
  };
}

export default function PSODashboard() {
  const [numTasks, setNumTasks] = useState(20);
  const [numVMs, setNumVMs] = useState(4);
  const [numParticles, setNumParticles] = useState(30);
  const [paramW, setParamW] = useState(0.9);
  const [paramC1, setParamC1] = useState(1.5);
  const [paramC2, setParamC2] = useState(1.5);
  const [maxIter, setMaxIter] = useState(200);
  const [tasks, setTasks] = useState(() => generateRandomTasks(20));
  const [vms, setVMs] = useState(() => generateRandomVMs(4));
  const [psoEnabled, setPsoEnabled] = useState(true);

  const [showConfig, setShowConfig] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [activeTab, setActiveTab] = useState('tasks');
  const [isRunning, setIsRunning] = useState(false);
  const [simState, setSimState] = useState(null);
  const [eventLog, setEventLog] = useState([]);
  const [replayData, setReplayData] = useState(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const replayTimerRef = useRef(null);
  const prevIsDoneRef = useRef(false);

  const optimizerRef = useRef(null);
  const isRunningRef = useRef(false);
  const animRef = useRef(null);
  const maxIterRef = useRef(maxIter);

  useEffect(() => { maxIterRef.current = maxIter; }, [maxIter]);

  useEffect(() => { setTasks(generateRandomTasks(numTasks)); }, [numTasks]);
  useEffect(() => { setVMs(generateRandomVMs(numVMs)); }, [numVMs]);

  const initSimulationWithState = useCallback((isPSO) => {
    isRunningRef.current = false;
    cancelAnimationFrame(animRef.current);
    setIsRunning(false);

    const OptimizerClass = isPSO ? PSOOptimizer : BasicOptimizer;
    const pso = new OptimizerClass({ tasks, vms, numParticles, w: paramW, c1: paramC1, c2: paramC2, maxIterations: maxIter });
    optimizerRef.current = pso;

    setSimState(buildInitialState(pso));
    setEventLog([{ iteration: 0, event: pso.lastEvent }]);
    setShowConfig(false);
  }, [tasks, vms, numParticles, paramW, paramC1, paramC2, maxIter]);

  const initSimulation = useCallback(() => {
    initSimulationWithState(psoEnabled);
  }, [initSimulationWithState, psoEnabled]);

  const handlePsoToggle = (enabled) => {
    setPsoEnabled(enabled);
    if (!enabled && activeTab === 'pso') setActiveTab('tasks');
    initSimulationWithState(enabled);
  };

  useEffect(() => {
    const OptimizerClass = psoEnabled ? PSOOptimizer : BasicOptimizer;
    const pso = new OptimizerClass({ tasks, vms, numParticles: 30, w: 0.9, c1: 1.5, c2: 1.5, maxIterations: 200 });
    optimizerRef.current = pso;
    setSimState(buildInitialState(pso));
    setEventLog([{ iteration: 0, event: pso.lastEvent }]);
  }, []);

  const startLoop = useCallback(() => {
    const tick = () => {
      if (!isRunningRef.current) return;
      const pso = optimizerRef.current;
      if (!pso || pso.iteration >= maxIterRef.current) {
        isRunningRef.current = false;
        setIsRunning(false);
        return;
      }
      const s = pso.step();
      setSimState({ ...s, workload: pso.getVMWorkload() });
      if (s.event) {
        setEventLog(prev => [{ iteration: s.iteration, event: s.event }, ...prev]);
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  }, []);

  const handleRunPause = useCallback(() => {
    if (isRunningRef.current) {
      isRunningRef.current = false;
      cancelAnimationFrame(animRef.current);
      setIsRunning(false);
    } else {
      if (!optimizerRef.current || optimizerRef.current.iteration >= maxIterRef.current) return;
      isRunningRef.current = true;
      setIsRunning(true);
      startLoop();
    }
  }, [startLoop]);

  const handleStep = useCallback(() => {
    const pso = optimizerRef.current;
    if (!pso || pso.iteration >= maxIterRef.current || isRunningRef.current) return;
    const s = pso.step();
    setSimState({ ...s, workload: pso.getVMWorkload() });
    if (s.event) {
      setEventLog(prev => [{ iteration: s.iteration, event: s.event }, ...prev]);
    }
  }, []);

  const isDone = simState && (!psoEnabled || simState.iteration >= maxIter);
  const hasStarted = simState && (!psoEnabled || simState.iteration > 0);


  useEffect(() => {
    if (isDone && psoEnabled && !prevIsDoneRef.current && simState && simState.history.length > 1) {

      clearInterval(replayTimerRef.current);
      setIsReplaying(true);
      const fullHistory = simState.history;
      let idx = 0;
      const step = Math.max(1, Math.floor(fullHistory.length / 30));
      const interval = 5;
      setReplayData([]);

      replayTimerRef.current = setInterval(() => {
        idx += step;
        if (idx >= fullHistory.length) {
          setReplayData(fullHistory);
          setIsReplaying(false);
          clearInterval(replayTimerRef.current);
        } else {
          setReplayData(fullHistory.slice(0, idx + 1));
        }
      }, interval);
    }
    prevIsDoneRef.current = isDone;
    return () => clearInterval(replayTimerRef.current);
  }, [isDone, psoEnabled, simState]);


  useEffect(() => {
    if (simState && simState.iteration === 0) {
      clearInterval(replayTimerRef.current);
      setReplayData(null);
      setIsReplaying(false);
      prevIsDoneRef.current = false;
    }
  }, [simState?.iteration]);

  return (
    <div className="relative min-h-screen bg-[#030303] text-white font-sans overflow-hidden">
      <InteractiveNeuralVortex />

      <div className="relative z-10 p-4 md:p-6 max-w-screen-2xl mx-auto">

        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
              PSO Cloud Scheduler
            </h1>
            <p className="text-gray-400 text-sm mt-1">Particle Swarm Optimization — Task Scheduling Visualizer</p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <motion.button
              onClick={() => handlePsoToggle(!psoEnabled)}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 shadow-lg border ${
                psoEnabled 
                  ? 'bg-slate-700 hover:bg-slate-600 border-slate-500 text-gray-200 shadow-[0_0_15px_rgba(0,0,0,0.4)]'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-blue-400/50 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]'
              }`}
              whileTap={{ scale: 0.95 }}
              layout
            >
              <AnimatePresence mode="wait" initial={false}>
                {psoEnabled ? (
                  <motion.div
                    key="disable"
                    initial={{ opacity: 0, y: -15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 15 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-1.5"
                  >
                    <Pause size={15} /> Disable PSO
                  </motion.div>
                ) : (
                  <motion.div
                    key="enable"
                    initial={{ opacity: 0, y: -15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 15 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-1.5"
                  >
                    <Zap size={15} /> Enable PSO
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
            {psoEnabled && (
              <>
                <button onClick={handleStep} disabled={isRunning || isDone || !simState}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 shadow-lg">
                  <SkipForward size={15} /> Step
                </button>
                <button onClick={handleRunPause} disabled={isDone || !simState}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all disabled:opacity-40">
                  {isRunning ? <><Pause size={15}/> Pause</> : <><Play size={15}/> Run</>}
                </button>
              </>
            )}
          </div>
        </header>

        <FloatingActionMenu
          options={[
            {
              label: "Glossary",
              Icon: <BookOpen className="w-5 h-5" />,
              onClick: () => setShowGlossary(true),
            },
            {
              label: "Configure",
              Icon: <Settings className="w-5 h-5" />,
              onClick: () => setShowConfig(true),
            },
            {
              label: "Reset",
              Icon: <RotateCcw className="w-5 h-5" />,
              onClick: initSimulation,
            },
          ]}
        />

        <AnimatePresence>
          {showGlossary && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="glass-panel p-5 mb-5 overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-gray-200 flex items-center gap-2"><BookOpen size={15}/> Key Terms</h2>
                <button onClick={() => setShowGlossary(false)} className="text-gray-500 hover:text-gray-300"><X size={16}/></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                {GLOSSARY.map(g => (
                  <div key={g.term} className="text-xs">
                    <span className="font-semibold text-blue-400">{g.term}: </span>
                    <span className="text-gray-400">{g.def}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showConfig && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="glass-panel p-5 mb-5 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-200 flex items-center gap-2"><Settings size={15}/> Configuration</h2>
                <button onClick={() => setShowConfig(false)} className="text-gray-500 hover:text-gray-300"><X size={16}/></button>
              </div>
              <div className="flex gap-2 mb-5">
                {['tasks', 'vms', ...(psoEnabled ? ['pso'] : [])].map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all ${activeTab === tab ? 'bg-blue-600 text-white' : 'bg-slate-800 text-gray-400 hover:text-white'}`}>
                    {tab === 'tasks' ? `Tasks (${numTasks})` : tab === 'vms' ? `VMs (${numVMs})` : 'PSO Params'}
                  </button>
                ))}
              </div>

              {activeTab === 'tasks' && (
                <div>
                  <LabeledSlider label="Number of Tasks" hint="Each task is a cloudlet to be assigned to a VM." value={numTasks} min={5} max={60} onChange={setNumTasks} />
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-400">Edit task lengths (Million Instructions):</p>
                    <button onClick={() => setTasks(generateRandomTasks(numTasks))} className="text-xs text-blue-400 bg-blue-500/10 px-3 py-1 rounded-lg">↺ Randomize</button>
                  </div>
                  <TaskEditor tasks={tasks} onUpdate={setTasks} />
                </div>
              )}

              {activeTab === 'vms' && (
                <div>
                  <LabeledSlider label="Number of VMs" hint="More VMs = more parallel workers." value={numVMs} min={2} max={10} onChange={setNumVMs} />
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-400">Edit VM speeds (MIPS):</p>
                    <button onClick={() => setVMs(generateRandomVMs(numVMs))} className="text-xs text-green-400 bg-green-500/10 px-3 py-1 rounded-lg">↺ Randomize</button>
                  </div>
                  <VMEditor vms={vms} onUpdate={setVMs} />
                </div>
              )}

              {activeTab === 'pso' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <LabeledSlider label="Particle Count" hint="More particles = better search but slower." value={numParticles} min={5} max={100} onChange={setNumParticles} />
                    <LabeledSlider label="Max Iterations" hint="How many rounds the swarm evolves. (0 = no optimization)" value={maxIter} min={0} max={500} onChange={setMaxIter} />
                  </div>
                  <div>
                    <LabeledSlider label="Inertia (w)" hint="High = explore more. Low = converge faster." value={paramW} min={0.1} max={1.5} step={0.05} onChange={setParamW} />
                    <LabeledSlider label="Cognitive (c1)" hint="How much each particle trusts its own memory." value={paramC1} min={0.5} max={3.0} step={0.1} onChange={setParamC1} />
                    <LabeledSlider label="Social (c2)" hint="How much each particle follows the swarm's best." value={paramC2} min={0.5} max={3.0} step={0.1} onChange={setParamC2} />
                  </div>
                </div>
              )}

              <div className="mt-5 pt-4 border-t border-slate-700 flex justify-end">
                <button onClick={initSimulation}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all">
                  <Zap size={15}/> Apply & Restart
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {simState && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
              <div className="glass-panel p-4 flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400"><Activity size={22}/></div>
                <div>
                  <p className="text-gray-400 text-xs">Best Makespan</p>
                  <p className="text-2xl font-bold font-mono">{simState.gBestFitness.toFixed(1)}<span className="text-sm text-gray-400 ml-1">ms</span></p>
                </div>
              </div>
              <div className="glass-panel p-4 flex items-center gap-3">
                <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400"><Cpu size={22}/></div>
                <div>
                  <p className="text-gray-400 text-xs">Iteration</p>
                  <p className="text-2xl font-bold font-mono">{psoEnabled ? simState.iteration : '-'}<span className="text-sm text-gray-400 ml-1">{psoEnabled ? `/ ${maxIter}` : ''}</span></p>
                </div>
              </div>
              <div className="glass-panel p-4 flex items-center gap-3">
                <div className="p-3 bg-green-500/10 rounded-xl text-green-400"><Server size={22}/></div>
                <div>
                  <p className="text-gray-400 text-xs">Inertia w</p>
                  <p className="text-2xl font-bold font-mono">{psoEnabled ? (simState.w ?? paramW).toFixed(3) : '-'}</p>
                </div>
              </div>
              <div className="glass-panel p-4 flex items-center gap-3">
                <div className="p-3 bg-yellow-500/10 rounded-xl text-yellow-400"><Zap size={22}/></div>
                <div>
                  <p className="text-gray-400 text-xs">Particles</p>
                  <p className="text-2xl font-bold font-mono">{psoEnabled ? numParticles : '-'}<span className="text-sm text-gray-400 ml-1">{psoEnabled ? 'swarm' : ''}</span></p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
              <div className="glass-panel p-5 xl:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-200">Task Allocation</h2>
                  {!hasStarted
                    ? <span className="text-xs text-yellow-400 bg-yellow-500/10 px-3 py-1 rounded-lg">⏳ Press Run to start</span>
                    : <span className="text-xs text-gray-500 bg-slate-800 px-2 py-1 rounded-lg">gBest schedule</span>
                  }
                </div>
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(simState.vms.length, 5)}, 1fr)` }}>
                  {simState.workload.map(vm => {
                    const maxExec = Math.max(...simState.workload.map(v => v.execTime));
                    const isBottleneck = hasStarted && vm.execTime === maxExec && maxExec > 0;
                    const assigned = hasStarted ? vm.assigned : [];
                    const execTime = hasStarted ? vm.execTime : 0;

                    return (
                      <div key={vm.id} className={`rounded-xl border p-3 relative overflow-hidden transition-all ${isBottleneck ? 'border-red-500/50 bg-red-900/10' : 'border-slate-700/50 bg-slate-800/40'}`}>
                        {isBottleneck && (
                          <div className="absolute top-1 right-1 text-[9px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded font-semibold">⚠ BOTTLENECK</div>
                        )}
                        <h3 className={`font-bold text-sm mb-0.5 ${isBottleneck ? 'text-red-400' : 'text-blue-400'}`}>{vm.name}</h3>
                        <p className="text-[10px] text-gray-500 mb-2">{vm.mips} MIPS · {assigned.length} tasks</p>

                        <div className="mb-2 h-14 flex flex-wrap gap-1 content-start overflow-y-auto custom-scrollbar">
                          {!hasStarted
                            ? <p className="text-[10px] text-gray-600 italic w-full">waiting...</p>
                            : (
                              <AnimatePresence>
                                {assigned.map(t => (
                                  <motion.div key={t.id}
                                    initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0 }}
                                    className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.5)]"
                                    title={`${t.name} — ${(t.length / 1000).toFixed(0)}k MI`}
                                  />
                                ))}
                              </AnimatePresence>
                            )
                          }
                        </div>

                        <div className="h-1 bg-slate-700 rounded-full overflow-hidden mb-2">
                          <motion.div
                            className={`h-full rounded-full ${isBottleneck ? 'bg-red-500' : 'bg-blue-500'}`}
                            animate={{ width: hasStarted && maxExec > 0 ? `${(execTime / maxExec) * 100}%` : '0%' }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>

                        <div className="bg-slate-900/60 p-1.5 rounded-lg">
                          <p className="text-[9px] text-gray-400 uppercase">Exec Time</p>
                          <p className={`font-mono text-xs font-bold ${isBottleneck ? 'text-red-400' : hasStarted ? 'text-green-400' : 'text-gray-600'}`}>
                            {hasStarted ? `${execTime.toFixed(1)} ms` : '—'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {hasStarted && (
                  <p className="text-xs text-gray-500 mt-3">
                    <span className="text-red-400 font-semibold">⚠ Bottleneck VM</span> = slowest VM — defines the makespan. PSO moves tasks away from it.
                  </p>
                )}
              </div>

              <div className="glass-panel p-5">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-bold text-gray-200">Convergence Curve</h2>
                  {isReplaying && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1.5"
                    >
                      <motion.span
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ repeat: Infinity, duration: 1 }}
                        className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"
                      />
                      Replaying
                    </motion.span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-4">Makespan drops as the swarm finds better schedules. Flattening = converged.</p>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={isReplaying && replayData ? replayData : simState.history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="iteration" stroke="#475569" tick={{ fill: '#475569', fontSize: 10 }}
                        domain={isDone && psoEnabled ? [0, maxIter] : undefined}
                        type="number"
                      />
                      <YAxis
                        dataKey="makespan" stroke="#475569" tick={{ fill: '#475569', fontSize: 10 }}
                        domain={isDone && simState.history.length > 1
                          ? [Math.floor(simState.history[simState.history.length - 1].makespan * 0.95), Math.ceil(simState.history[0].makespan * 1.05)]
                          : ['auto', 'auto']}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }}
                        itemStyle={{ color: '#60a5fa' }}
                        formatter={v => [`${v.toFixed(2)} ms`, 'Makespan']}
                      />
                      <Line
                        type="monotone" dataKey="makespan"
                        stroke={isReplaying ? '#818cf8' : '#3b82f6'}
                        strokeWidth={isReplaying ? 3 : 2.5}
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 0, fill: '#60a5fa' }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {simState.iteration > 1 && !isReplaying && (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-800/50 rounded-lg p-2">
                      <p className="text-gray-400">Initial</p>
                      <p className="font-mono text-yellow-400 font-bold">{simState.history[0].makespan.toFixed(1)} ms</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-2">
                      <p className="text-gray-400">Improvement</p>
                      <p className="font-mono text-green-400 font-bold">
                        -{((simState.history[0].makespan - simState.gBestFitness) / simState.history[0].makespan * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                )}
                <AnimatePresence>
                  {isDone && psoEnabled && !isReplaying && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="mt-3 p-3 bg-green-900/20 border border-green-700/40 rounded-lg text-xs text-green-400 font-semibold text-center"
                    >
                      ✅ Optimization complete — {maxIter} iterations done
                    </motion.div>
                  )}
                </AnimatePresence>
                {!psoEnabled && (
                  <div className="mt-3 p-3 bg-slate-800/50 border border-slate-700/40 rounded-lg text-xs text-blue-400 font-semibold text-center">
                    ℹ️ Baseline Scheduling — No iterations needed
                  </div>
                )}
              </div>
            </div>

            <AnimatePresence>
              {hasStarted && (
                <motion.div
                  initial={{ opacity: 0, y: 30, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="glass-panel p-5"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Info size={15} className="text-blue-400" />
                    <h2 className="text-lg font-bold text-gray-200">What's Happening Right Now</h2>
                    <span className="ml-auto text-xs text-gray-500">{eventLog.length} events</span>
                  </div>
                  <div className="w-full max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {eventLog.map((entry, i) => (
                      <EventEntry key={i} event={entry.event} iteration={entry.iteration} isLatest={i === 0} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
