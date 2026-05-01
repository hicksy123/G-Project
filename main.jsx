import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const STORAGE_KEY = 'g_project_training_logger_v6';
const SPLASH_KEY = 'g_project_seen_splash_v1';
const REST_SECONDS = 60;

const plan = {
  workouts: [
    {
      day: 'Day 1', title: 'Heavy Bench + Upper', exercises: [
        { name: 'Bench Press (Barbell)', target: 'Warm-up, then 5 x 5', defaultWeight: 75, reps: 5, sets: 5, warmups: [{ weight: 60, reps: 8 }] },
        { name: 'Incline Dumbbell Press', target: '3 x 8-10', defaultWeight: 24, reps: 8, sets: 3, warmups: [] },
        { name: 'Chest Fly (Machine)', target: '3 x 10-12', defaultWeight: 79, reps: 10, sets: 3, warmups: [] },
        { name: 'Triceps Pressdown', target: '3 x 10-12', defaultWeight: 25, reps: 10, sets: 3, warmups: [] },
        { name: 'Sit-up', target: '3 x 15-25', defaultWeight: 0, reps: 20, sets: 3, warmups: [] }
      ]
    },
    {
      day: 'Day 2', title: 'Legs + Ski Strength', exercises: [
        { name: 'Squat or Leg Press', target: '4 x 6-8', defaultWeight: 80, reps: 6, sets: 4, warmups: [{ weight: 50, reps: 8 }] },
        { name: 'Romanian Deadlift', target: '3 x 8', defaultWeight: 60, reps: 8, sets: 3, warmups: [{ weight: 40, reps: 8 }] },
        { name: 'Walking Lunges', target: '3 x 10 each leg', defaultWeight: 16, reps: 10, sets: 3, warmups: [] },
        { name: 'Calf Raise', target: '3 x 12-15', defaultWeight: 40, reps: 12, sets: 3, warmups: [] },
        { name: 'Plank', target: '3 x 45-60 sec', defaultWeight: 0, reps: 45, sets: 3, warmups: [] },
        { name: 'Sit-up', target: '3 x 15-25', defaultWeight: 0, reps: 20, sets: 3, warmups: [] }
      ]
    },
    {
      day: 'Day 3', title: 'Light Bench + Pull', exercises: [
        { name: 'Bench Press (Barbell)', target: '4 x 8', defaultWeight: 70, reps: 8, sets: 4, warmups: [{ weight: 60, reps: 8 }] },
        { name: 'Lat Pulldown', target: '4 x 8-10', defaultWeight: 55, reps: 8, sets: 4, warmups: [] },
        { name: 'Seated Row', target: '3 x 10', defaultWeight: 50, reps: 10, sets: 3, warmups: [] },
        { name: 'Dumbbell Shoulder Press', target: '3 x 8-10', defaultWeight: 18, reps: 8, sets: 3, warmups: [] },
        { name: 'Biceps Curl', target: '3 x 10-12', defaultWeight: 12, reps: 10, sets: 3, warmups: [] },
        { name: 'Sit-up', target: '3 x 15-25', defaultWeight: 0, reps: 20, sets: 3, warmups: [] }
      ]
    },
    {
      day: 'Day 4', title: 'Arms + Ski Conditioning', exercises: [
        { name: 'Close Grip Bench', target: '3 x 8', defaultWeight: 60, reps: 8, sets: 3, warmups: [{ weight: 40, reps: 8 }] },
        { name: 'Cable Row', target: '3 x 10', defaultWeight: 50, reps: 10, sets: 3, warmups: [] },
        { name: 'Hammer Curl', target: '3 x 10', defaultWeight: 14, reps: 10, sets: 3, warmups: [] },
        { name: 'Dips or Assisted Dips', target: '3 x 8-12', defaultWeight: 0, reps: 8, sets: 3, warmups: [] },
        { name: 'Skierg', target: '10-20 min steady', defaultWeight: 0, reps: 10, sets: 1, warmups: [] },
        { name: 'Sit-up', target: '3 x 15-25', defaultWeight: 0, reps: 20, sets: 3, warmups: [] }
      ]
    }
  ],
  runs: [
    { title: 'Run 1', target: 'Easy 10 km', type: 'Easy', defaultDistance: 10 },
    { title: 'Run 2', target: 'Easy 10 km + strides', type: 'Easy + strides', defaultDistance: 10 },
    { title: 'Run 3', target: 'Tempo / threshold', type: 'Tempo', defaultDistance: 8 },
    { title: 'Run 4', target: 'Long easy run', type: 'Long', defaultDistance: 12 }
  ]
};

function today() { return new Date().toISOString().slice(0, 10); }
function niceDate(date) { return new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }); }
function id() { return crypto?.randomUUID?.() || `id_${Date.now()}_${Math.random().toString(16).slice(2)}`; }
function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { sessions: [], runs: [] }; } catch { return { sessions: [], runs: [] }; } }
function saveData(sessions, runs) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions, runs })); } catch {} }
function dayKey(offset = 0) { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); }
function last7Days() { return Array.from({ length: 7 }, (_, i) => dayKey(i - 6)); }

function suggestNextWeight(exerciseName, defaultWeight, sessions) {
  const history = sessions
    .flatMap(s => (s.exercises || []).flatMap(e => (e.rows || []).map(r => ({ ...r, exercise: e.exercise, savedAt: s.savedAt || s.date }))))
    .filter(r => r.exercise === exerciseName && r.type !== 'warmup' && r.done && Number(r.weight) > 0)
    .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));

  if (!history.length) return Number(defaultWeight || 0);

  const latestWeight = Number(history[0].weight || defaultWeight || 0);
  const targetReps = Number(history[0].targetReps || history[0].reps || 0);
  const latestSameWeight = history.filter(r => Number(r.weight) === latestWeight).slice(0, 6);
  const completed = latestSameWeight.filter(r => Number(r.reps) >= targetReps).length;
  const close = latestSameWeight.filter(r => Number(r.reps) >= Math.max(1, targetReps - 1)).length;
  const poor = latestSameWeight.filter(r => Number(r.reps) <= Math.max(1, targetReps - 2)).length;

  let step = latestWeight >= 30 ? 2.5 : 1;
  if (!exerciseName.toLowerCase().includes('bench') && latestWeight >= 50) step = 5;

  if (completed >= Math.min(3, latestSameWeight.length)) return latestWeight + step;
  if (close >= Math.min(3, latestSameWeight.length)) return latestWeight + step;
  if (poor >= 2) return Math.max(0, latestWeight - step);
  return latestWeight;
}

function makeRows(ex, sessions) {
  const main = suggestNextWeight(ex.name, ex.defaultWeight, sessions);
  const warmups = (ex.warmups || []).map((w, i) => ({ id: id(), type: 'warmup', label: i ? `Warm-up ${i + 1}` : 'Warm-up', previous: `${w.weight}kg x ${w.reps}`, weight: w.weight, reps: w.reps, targetReps: w.reps, done: false, date: today() }));
  const sets = Array.from({ length: ex.sets }, (_, i) => ({ id: id(), type: 'work', label: `Set ${i + 1}`, previous: `${main}kg x ${ex.reps}`, weight: main, reps: ex.reps, targetReps: ex.reps, done: false, date: today() }));
  return [...warmups, ...sets];
}

function Splash({ onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 5000);
    return () => clearTimeout(timer);
  }, [onDone]);
  return <div className="splash">
    <div className="splashSmoke"></div>
    <img src="/g-project-logo.png" alt="G-Project" className="splashLogo" />
    <div className="loadingBar"><span /></div>
    <button className="skipSplash" onClick={onDone}>Enter</button>
  </div>;
}

function App() {
  const [showSplash, setShowSplash] = useState(() => sessionStorage.getItem(SPLASH_KEY) !== 'yes');
  const [tab, setTab] = useState('gym');
  const [activeWorkout, setActiveWorkout] = useState(0);
  const [sessions, setSessions] = useState([]);
  const [runs, setRuns] = useState([]);
  const [rows, setRows] = useState({});
  const [runDrafts, setRunDrafts] = useState({});
  const [savedMsg, setSavedMsg] = useState('');
  const [rest, setRest] = useState(0);

  useEffect(() => { const data = load(); setSessions(data.sessions || []); setRuns(data.runs || []); }, []);
  useEffect(() => {
    const next = {};
    plan.workouts[activeWorkout].exercises.forEach(ex => { next[ex.name] = makeRows(ex, sessions); });
    setRows(next);
  }, [activeWorkout, sessions.length]);
  useEffect(() => {
    if (!rest) return;
    const t = setTimeout(() => setRest(s => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [rest]);

  const workout = plan.workouts[activeWorkout];
  const stats = useMemo(() => {
    const all = Object.values(rows).flat();
    const done = all.filter(r => r.done);
    return { sets: done.length, volume: done.reduce((s, r) => s + Number(r.weight || 0) * Number(r.reps || 0), 0) };
  }, [rows]);
  const workoutComplete = Object.values(rows).flat().length > 0 && Object.values(rows).flat().every(r => r.done);

  function closeSplash() { sessionStorage.setItem(SPLASH_KEY, 'yes'); setShowSplash(false); }
  if (showSplash) return <Splash onDone={closeSplash} />;

  function updateRow(ex, rowId, field, value) {
    setRows(prev => ({ ...prev, [ex]: prev[ex].map(r => r.id === rowId ? { ...r, [field]: value } : r) }));
  }
  function toggle(ex, rowId) {
    setRows(prev => ({ ...prev, [ex]: prev[ex].map(r => {
      if (r.id !== rowId) return r;
      const nextDone = !r.done;
      if (nextDone) setRest(REST_SECONDS);
      return { ...r, done: nextDone, date: today() };
    }) }));
  }
  function addSet(ex) {
    setRows(prev => {
      const current = prev[ex.name] || [];
      const last = [...current].reverse().find(r => r.type === 'work') || { weight: ex.defaultWeight, reps: ex.reps };
      const count = current.filter(r => r.type === 'work').length;
      return { ...prev, [ex.name]: [...current, { id: id(), type: 'work', label: `Set ${count + 1}`, previous: `${last.weight}kg x ${last.reps}`, weight: last.weight, reps: last.reps, targetReps: ex.reps, done: false, date: today() }] };
    });
  }
  function saveWorkout() {
    const session = { id: id(), date: today(), savedAt: new Date().toISOString(), workout: workout.title, volume: stats.volume, sets: stats.sets, exercises: Object.entries(rows).map(([exercise, rows]) => ({ exercise, rows })) };
    const nextSessions = [session, ...sessions];
    setSessions(nextSessions);
    saveData(nextSessions, runs);
    setSavedMsg('Workout saved');
    setTimeout(() => setSavedMsg(''), 1800);
  }
  function updateRunDraft(title, field, value) {
    setRunDrafts(prev => ({ ...prev, [title]: { ...(prev[title] || {}), [field]: value } }));
  }
  function saveRun(run) {
    const draft = runDrafts[run.title] || {};
    const existing = runs.find(r => r.title === run.title && r.date === today());
    const entry = {
      id: existing?.id || id(), date: today(), savedAt: new Date().toISOString(), ...run,
      completed: true,
      distance: draft.distance || run.defaultDistance,
      time: draft.time || '',
      notes: draft.notes || ''
    };
    const nextRuns = [entry, ...runs.filter(r => !(r.title === run.title && r.date === today()))];
    setRuns(nextRuns);
    saveData(sessions, nextRuns);
    setSavedMsg('Run saved');
    setTimeout(() => setSavedMsg(''), 1800);
  }
  function undoRun(run) {
    const nextRuns = runs.filter(r => !(r.title === run.title && r.date === today()));
    setRuns(nextRuns);
    saveData(sessions, nextRuns);
  }
  function resetDraft() {
    if (!confirm('Clear unsaved changes for this workout?')) return;
    const next = {};
    workout.exercises.forEach(ex => { next[ex.name] = makeRows(ex, sessions); });
    setRows(next);
  }

  const weekItems = [...sessions.map(s => ({ ...s, kind: 'Gym' })), ...runs.map(r => ({ ...r, kind: 'Run' }))];

  return <div className="app">
    <header className="top">
      <div className="brand"><img src="/g-project-logo.png" alt="G-Project" /><div><h1>G-Project</h1><p>Bench to 100kg + Engadin prep</p></div></div>
      {savedMsg && <span className="saved">{savedMsg}</span>}
    </header>

    {rest > 0 && <div className="restTimer"><b>Rest timer</b><span>{rest}s</span><button onClick={() => setRest(0)}>Skip</button></div>}

    <nav className="tabs">{['gym', 'runs', 'week', 'history'].map(t => <button key={t} onClick={() => setTab(t)} className={tab === t ? 'active' : ''}>{t}</button>)}</nav>

    {tab === 'gym' && <main>
      <div className="chooser">{plan.workouts.map((w, i) => <button key={w.day} onClick={() => setActiveWorkout(i)} className={activeWorkout === i ? 'active' : ''}><b>{w.day}</b><small>{w.title}</small></button>)}</div>
      <section className={`sessionHead ${workoutComplete ? 'complete' : ''}`}><div><b>{workout.day}: {workout.title}</b><small>Save button stores the workout. Ticks are draft only until saved.</small></div><button onClick={saveWorkout}>Save</button><button className="secondary" onClick={resetDraft}>Reset</button><div className="metrics"><span>Volume<br/><b>{stats.volume}kg</b></span><span>Sets<br/><b>{stats.sets}</b></span></div></section>
      {workout.exercises.map(ex => {
        const exRows = rows[ex.name] || [];
        const allDone = exRows.length > 0 && exRows.every(r => r.done);
        return <section className="exercise" key={ex.name}>
          <div className={`exHead ${allDone ? 'complete' : ''}`}><h2>{ex.name}</h2><p>{ex.target}</p></div>
          <div className="grid head"><span>Set</span><span>Suggested</span><span>KG</span><span>Reps</span><span>✓</span></div>
          {exRows.map(r => <div key={r.id} className={`grid row ${r.done ? 'done' : ''}`}>
            <span className="label">{r.label}</span><span className="prev">{r.previous}</span>
            <input type="number" step="0.5" value={r.weight} onChange={e => updateRow(ex.name, r.id, 'weight', e.target.value)} />
            <input type="number" value={r.reps} onChange={e => updateRow(ex.name, r.id, 'reps', e.target.value)} />
            <button className="tick" onClick={() => toggle(ex.name, r.id)}>{r.done ? '↺' : '✓'}</button>
          </div>)}
          <button className="add" onClick={() => addSet(ex)}>＋ Add Set</button>
        </section>;
      })}
    </main>}

    {tab === 'runs' && <main>{plan.runs.map(run => {
      const existing = runs.find(r => r.title === run.title && r.date === today());
      const draft = runDrafts[run.title] || {};
      return <section key={run.title} className={`run ${existing ? 'complete' : ''}`}>
        <div className="runTop"><div><h2>{run.title}: {run.type}</h2><p>{run.target}</p></div><button onClick={() => existing ? undoRun(run) : saveRun(run)}>{existing ? 'Undo ✓' : 'Save Run'}</button></div>
        <div className="runFields"><label>Distance km<input type="number" step="0.1" value={draft.distance ?? existing?.distance ?? run.defaultDistance} onChange={e => updateRunDraft(run.title, 'distance', e.target.value)} /></label><label>Time<input placeholder="e.g. 52:30" value={draft.time ?? existing?.time ?? ''} onChange={e => updateRunDraft(run.title, 'time', e.target.value)} /></label></div>
      </section>;
    })}</main>}

    {tab === 'week' && <main>{last7Days().map(d => {
      const items = weekItems.filter(i => i.date === d);
      return <section className="weekDay" key={d}><h2>{niceDate(d)}</h2>{items.length ? items.map(item => <p key={item.id}><b>{item.kind}</b> · {item.kind === 'Gym' ? `${item.workout} (${item.sets} sets)` : `${item.title} ${item.distance || ''}km ${item.time || ''}`}</p>) : <p className="muted">No logged training</p>}</section>;
    })}</main>}

    {tab === 'history' && <main><button className="danger" onClick={() => { if(confirm('Delete all saved logs?')) { setSessions([]); setRuns([]); saveData([], []); }}}>Clear all</button>{weekItems.sort((a,b)=>new Date(b.savedAt || b.date)-new Date(a.savedAt || a.date)).map(item => <section className="history" key={item.id}><b>{item.kind === 'Gym' ? item.workout : item.title}</b><p>{item.date} · {item.kind === 'Gym' ? `${item.sets} sets · ${item.volume}kg` : `${item.distance || '-'}km · ${item.time || 'no time'}`}</p></section>)}</main>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
