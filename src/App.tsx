import { useState, useEffect, useReducer, Suspense, lazy } from 'react';
import { 
  LayoutDashboard, CheckSquare, Briefcase, FileText, PenTool, 
  LogOut, Smartphone, Settings, Clock, AlertCircle, ArrowRight,
  Moon, Sun, CalendarDays, X, Plus
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { 
    getFirestore, collection, doc, setDoc, deleteDoc, 
    onSnapshot, query, where, enableIndexedDbPersistence
} from "firebase/firestore";
import { 
    getAuth, 
    signInWithPhoneNumber, 
    RecaptchaVerifier, 
    onAuthStateChanged, 
    signOut 
} from "firebase/auth";

import confetti from 'canvas-confetti';

// --- LAZY LOAD FEATURES ---
const TaskManager = lazy(() => import('./features/tasks/TaskManager').then(module => ({ default: module.TaskManager })));
const ProjectsHub = lazy(() => import('./features/projects/ProjectsHub').then(module => ({ default: module.ProjectsHub })));
const DocsModule = lazy(() => import('./features/docs/DocsModule').then(module => ({ default: module.DocsModule })));
const WhiteboardModule = lazy(() => import('./features/whiteboard/WhiteboardModule').then(module => ({ default: module.WhiteboardModule })));
const SettingsModule = lazy(() => import('./features/settings/SettingsModule').then(module => ({ default: module.SettingsModule })));

// --- CONFIG ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "flowstatehy.firebaseapp.com",
  projectId: "flowstatehy",
  storageBucket: "flowstatehy.firebasestorage.app",
  messagingSenderId: "630822916494",
  appId: "1:630822916494:web:25eb16e22f0be30c3814df"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

try { enableIndexedDbPersistence(db).catch(() => {}); } catch(e) {}

// --- UTILS (FIXED FOR LOCAL TIMEZONE) ---
const toLocalISOString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getToday = () => toLocalISOString(new Date());

const getTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toLocalISOString(d);
};

const getNextMonday = () => {
    const d = new Date();
    d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7));
    return toLocalISOString(d);
};

const generateId = () => crypto.randomUUID();

const DB = {
    saveItem: async (uid: string, collectionName: string, item: any) => {
        if (!uid || !item.id) return;
        await setDoc(doc(db, "users", uid, collectionName, item.id), item, { merge: true });
    },
    deleteItem: async (uid: string, collectionName: string, itemId: string) => {
        if (!uid || !itemId) return;
        await deleteDoc(doc(db, "users", uid, collectionName, itemId));
    }
};

const initialState = {
  user: null, 
  tasks: [], 
  projects: [], 
  docs: [], 
  whiteboards: [] 
};

function appReducer(state: any, action: any) {
  switch (action.type) {
    case 'SET_USER': return { ...state, user: action.payload };
    case 'SYNC_COLLECTION': return { ...state, [action.payload.name]: action.payload.data };
    case 'IMPORT_DATA': return { ...state, ...action.payload };
    default: return state;
  }
}

// --- COMPONENTS ---

const Sidebar = ({ activeTab, setActiveTab, lastSaved, onShutdown }: any) => {
  const menu = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Today\'s Focus' },
    { id: 'tasks', icon: CheckSquare, label: 'Task Manager' },
    { id: 'projects', icon: Briefcase, label: 'Projects' },
    { id: 'docs', icon: FileText, label: 'Docs' },
    { id: 'whiteboard', icon: PenTool, label: 'Whiteboards' },
    { id: 'settings', icon: Settings, label: 'Data & Security' }
  ];

  return (
    <div className="w-64 h-screen glass-heavy flex flex-col fixed left-0 top-0 z-20">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">FlowState</h1>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {menu.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === item.id ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}>
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
      
      <div className="p-4 space-y-2">
          {/* Shutdown Button */}
          <button onClick={onShutdown} className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white py-2 rounded-xl text-sm font-bold transition-all border border-slate-700 hover:border-indigo-500">
             <Moon size={16} /> End Day Ritual
          </button>

          <div className="pt-2 border-t border-slate-800 text-xs text-emerald-400 flex items-center gap-2 justify-center" style={{ opacity: lastSaved ? 1 : 0.5 }}>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Synced {lastSaved}
          </div>
      </div>
    </div>
  );
};

// --- SHUTDOWN WIZARD ---
const ShutdownWizard = ({ isOpen, onClose, tasks, dispatch }: any) => {
    const [step, setStep] = useState(1);
    
    // PENDING: Tasks that are NOT archived AND NOT Done AND (Due Today OR Overdue)
    const pendingTasks = tasks.filter((t:any) => 
        !t.archived && 
        t.status !== 'Done' && 
        (t.dueDate <= getToday())
    );

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            // We keep the confetti because finishing the day is worth celebrating!
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 animate-[fadeIn_0.3s_ease-out]">
            <div className="glass-heavy max-w-lg w-full rounded-3xl p-8 relative border border-slate-700 shadow-2xl">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white">
                    <X size={24} />
                </button>

                {/* STEP 1: COZY INTRO (No Stats) */}
                {step === 1 && (
                    <div className="text-center space-y-6 py-8">
                        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-4xl animate-bounce">
                            🍵
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold text-white mb-2">Time to unplug.</h2>
                            <p className="text-slate-400 text-lg">Great work today, Hanna. Let's clear your mind before you go.</p>
                        </div>
                        <button onClick={() => setStep(2)} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl text-lg transition-all shadow-lg shadow-blue-900/20">
                            Review Remaining Tasks →
                        </button>
                    </div>
                )}

                {/* STEP 2: CLEAN UP */}
                {step === 2 && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-white">Clear the deck.</h2>
                            <p className="text-slate-400">Move unfinished tasks so you can start fresh tomorrow.</p>
                        </div>
                        
                        <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                            {pendingTasks.length === 0 ? (
                                <div className="text-center py-8 text-slate-500 italic">
                                    No pending tasks due today. You are free! 🕊️
                                </div>
                            ) : pendingTasks.map((t:any) => (
                                <div key={t.id} className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                                    <div className="font-medium text-slate-200 truncate max-w-[180px]">{t.title}</div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => dispatch({ type: 'UPDATE_TASK', payload: { id: t.id, dueDate: getTomorrow() } })}
                                            className="px-3 py-1.5 bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                                        >
                                            <Sun size={12} /> Tmrw
                                        </button>
                                        <button 
                                            onClick={() => dispatch({ type: 'UPDATE_TASK', payload: { id: t.id, dueDate: getNextMonday() } })}
                                            className="px-3 py-1.5 bg-purple-600/10 text-purple-400 hover:bg-purple-600 hover:text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                                        >
                                            <CalendarDays size={12} /> Mon
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {pendingTasks.length === 0 ? (
                             <button onClick={() => { setStep(3); confetti({ particleCount: 200, spread: 100 }); }} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl text-lg transition-all shadow-lg shadow-emerald-900/20">
                                All Clear! Finish Up →
                            </button>
                        ) : (
                            <div className="text-center text-xs text-slate-500">
                                {pendingTasks.length} tasks remaining
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 3: GOOD NIGHT */}
                {step === 3 && (
                    <div className="text-center space-y-6 py-8">
                        <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto text-4xl">
                            🌙
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold text-white mb-2">Good Evening, Hanna.</h2>
                            <p className="text-slate-400 text-lg">Your system is organized. Your mind is free.</p>
                        </div>
                        <button onClick={onClose} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl text-lg transition-all border border-slate-700">
                            Close & Relax
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- CUTE LOADING FALLBACK ---
const LoadingFallback = () => {
    // Pick a random message on mount
    const [message] = useState(() => {
        const msgs = [
            "Aligning the chakras... 🧘‍♀️",
            "Brewing digital coffee... ☕️",
            "Getting your flow ready... ✨",
            "Hello, Hanna! 👋",
            "Tying up loose ends... 🎀",
            "Checking the stars... 🌟"
        ];
        return msgs[Math.floor(Math.random() * msgs.length)];
    });

    return (
        <div className="flex flex-col items-center justify-center h-full text-slate-500 animate-pulse gap-4">
             <div className="text-xl font-bold text-blue-400">{message}</div>
        </div>
    );
};

// --- LOGIN SCREEN ---
const LoginScreen = () => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState("INPUT_PHONE");
  const [confirmObj, setConfirmObj] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { 'size': 'invisible' });
    }
  }, []);

  const handleSendCode = async (e: any) => {
    e.preventDefault();
    setError("");
    const appVerifier = (window as any).recaptchaVerifier;
    try {
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmObj(confirmationResult);
      setStep("INPUT_CODE");
    } catch (error: any) {
      setError("Failed: " + error.message);
      (window as any).recaptchaVerifier?.clear();
    }
  };

  const handleVerifyCode = async (e: any) => {
    e.preventDefault();
    if (!confirmObj) return;
    try { await confirmObj.confirm(verificationCode); } catch (error) { setError("Invalid code."); }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="glass p-8 rounded-2xl w-full max-w-md text-center space-y-6">
        <div className="w-16 h-16 bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <Smartphone size={32} className="text-blue-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">FlowState Login</h1>
        {step === "INPUT_PHONE" ? (
          <form onSubmit={handleSendCode} className="space-y-4">
             <input type="tel" placeholder="+1 555 555 5555" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-center text-lg" />
             <div id="recaptcha-container" />
             {error && <p className="text-red-400 text-xs">{error}</p>}
             <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl">Send Code</button>
          </form> 
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-4">
             <input type="text" placeholder="123456" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-center text-2xl tracking-[0.5em]" />
             {error && <p className="text-red-400 text-xs">{error}</p>}
             <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl">Verify & Enter</button>
          </form>
        )}
      </div>
    </div>
  );
};

// --- MAIN APP ---
function App() {
  const [state, localDispatch] = useReducer(appReducer, initialState);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  
  // NAVIGATION STATE (Deep Linking)
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [focusDocId, setFocusDocId] = useState<string | null>(null);
  const [focusBoardId, setFocusBoardId] = useState<string | null>(null);

  // SHUTDOWN STATE
  const [isShutdownOpen, setIsShutdownOpen] = useState(false);
  
  // QUICK ADD STATE
  const [isQuickTaskOpen, setIsQuickTaskOpen] = useState(false);

  // KEYBOARD SHORTCUT LISTENER (Alt + N)
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.altKey && e.key.toLowerCase() === 'n') {
              e.preventDefault(); // Stop default browser behavior
              setIsQuickTaskOpen(true);
          }
          if (e.key === 'Escape') {
              setIsQuickTaskOpen(false);
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 1. Auth Listener
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
        localDispatch({ type: 'SET_USER', payload: user || null });
    });
  }, []);

  // 2. Data Sync
  useEffect(() => {
    if (!state.user) return;
    const uid = state.user.uid;
    const unsubs: any[] = [];

    unsubs.push(onSnapshot(query(collection(db, "users", uid, "tasks"), where("archived", "==", false)), (snap) => {
        localDispatch({ type: 'SYNC_COLLECTION', payload: { name: 'tasks', data: snap.docs.map(d => ({ id: d.id, ...d.data() })) } });
        setLastSynced(new Date().toLocaleTimeString());
    }));

    ['projects', 'docs', 'whiteboards'].forEach(col => {
        unsubs.push(onSnapshot(collection(db, "users", uid, col), (snap) => {
            localDispatch({ type: 'SYNC_COLLECTION', payload: { name: col, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) } });
        }));
    });

    return () => unsubs.forEach(u => u());
  }, [state.user]);

  // --- 3. THE BOOT SEQUENCE (Client-Side Reset Engine) ---
  useEffect(() => {
      // Don't run until tasks are actually loaded from Firebase
      if (!state.user || state.tasks.length === 0) return;

      const today = getToday();
      const lastOpened = localStorage.getItem('flowstate_last_opened');

      if (lastOpened !== today) {
          console.log("🌅 New day detected! Running morning reset...");
          let tasksReset = 0;

          state.tasks.forEach((task: any) => {
              // If it's a recurring daily task that wasn't completed, bump it to today so it stays fresh!
              if (task.recurrence === 'Daily' && task.status !== 'Done' && task.dueDate < today) {
                  dispatch({ 
                      type: 'UPDATE_TASK', 
                      payload: { 
                          ...task, 
                          dueDate: today, 
                          statusNote: 'Auto-bumped by Morning Reset' 
                      } 
                  });
                  tasksReset++;
              }
          });

          // Mark today as "opened" so this engine goes to sleep until tomorrow
          localStorage.setItem('flowstate_last_opened', today);
          if (tasksReset > 0) console.log(`Reset ${tasksReset} daily tasks!`);
      }
  }, [state.user, state.tasks]); // Runs when tasks load

  // 4. Dispatch Wrapper
  const dispatch = (action: any) => {
    const uid = state.user?.uid;
    if (!uid) return;
    const today = getToday();

    if (action.type === 'ADD_TASK') DB.saveItem(uid, 'tasks', { id: generateId(), status: 'Not Started', archived: false, lastInteracted: today, ...action.payload });
    else if (action.type === 'UPDATE_TASK') DB.saveItem(uid, 'tasks', { ...action.payload, lastInteracted: today });
    else if (action.type === 'DELETE_TASK') DB.deleteItem(uid, 'tasks', action.payload);
    else if (action.type === 'RESTORE_TASK') DB.saveItem(uid, 'tasks', { id: action.payload, archived: false });
    else if (action.type === 'ARCHIVE_TASK') DB.saveItem(uid, 'tasks', { id: action.payload, archived: true });
    
    // Generic
    else if (action.type.startsWith('ADD_')) {
        const type = action.type.split('_')[1].toLowerCase() + 's'; 
        DB.saveItem(uid, type, { id: generateId(), lastUpdated: today, ...action.payload });
    }
    else if (action.type.startsWith('UPDATE_')) {
        const type = action.type.split('_')[1].toLowerCase() + 's';
        DB.saveItem(uid, type, { ...action.payload, lastUpdated: today });
    }
    else if (action.type.startsWith('DELETE_')) {
        const type = action.type.split('_')[1].toLowerCase() + 's';
        DB.deleteItem(uid, type, action.payload);
    }
    
    // Project Interaction
    else if (action.type === 'TOUCH_PROJECT') { 
        const p = state.projects.find((x:any) => x.id === action.payload); 
        if(p) DB.saveItem(uid, 'projects', { ...p, lastInteracted: today }); 
    }

    // MASS IMPORT
    else if (action.type === 'IMPORT_DATA') {
        const data = action.payload;
        localDispatch({ type: 'IMPORT_DATA', payload: data }); 
        const saveCollection = (items: any[], colName: string) => {
            items.forEach(item => DB.saveItem(uid, colName, item));
        };
        if(data.tasks) saveCollection(data.tasks, 'tasks');
        if(data.projects) saveCollection(data.projects, 'projects');
        if(data.docs) saveCollection(data.docs, 'docs');
        if(data.whiteboards) saveCollection(data.whiteboards, 'whiteboards');
    }
  };

  // --- DASHBOARD HELPERS ---
  const getDashboardData = () => {
      const today = getToday();
      const todaysTasks = state.tasks.filter((t:any) => {
          if (t.archived || t.status === 'Done') return false;
          return t.dueDate === today || t.dueDate < today;
      }).sort((a:any, b:any) => a.dueDate.localeCompare(b.dueDate));

      const recentFiles = [
          ...state.docs.map((d:any) => ({ ...d, type: 'doc', icon: FileText })),
          ...state.whiteboards.map((w:any) => ({ ...w, type: 'board', icon: PenTool }))
      ].sort((a:any, b:any) => {
           const dateA = a.lastUpdated || '0000-00-00';
           const dateB = b.lastUpdated || '0000-00-00';
           return dateB.localeCompare(dateA); 
      }).slice(0, 5); 

      return { todaysTasks, recentFiles, today };
  };

  const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) return 'Good Morning, Hanna.';
      if (hour < 18) return 'Good Afternoon, Hanna.';
      return 'Good Evening, Hanna.';
  };

  if (!state.user) return <LoginScreen />;

  const { todaysTasks, recentFiles } = getDashboardData();

  return (
    <div className="min-h-screen bg-slate-950 flex font-sans text-slate-200">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        lastSaved={lastSynced}
        onShutdown={() => setIsShutdownOpen(true)}
      />
      
      <main className="flex-1 ml-64 flex flex-col h-screen relative z-10 overflow-hidden">
        {/* --- UNIVERSAL QUICK TASK BAR --- */}
        <div className="w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-800 p-4 shrink-0 z-30">
            <div className="max-w-4xl mx-auto relative group flex items-center">
                <Plus size={18} className="absolute left-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                <input 
                    type="text"
                    placeholder="Quick Add Task... (Press Enter to save)"
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-slate-900 transition-all shadow-inner"
                    onKeyDown={(e: any) => {
                        if (e.key === 'Enter' && e.target.value.trim()) {
                            dispatch({ 
                                type: 'ADD_TASK', 
                                payload: { 
                                    title: e.target.value.trim(), 
                                    ice: 5,
                                    dueDate: getToday() // <-- Defaults to Today!
                                } 
                            });
                            e.target.value = '';
                            confetti({ particleCount: 30, spread: 50, origin: { y: 0.1 } }); // Tiny celebration!
                        }
                    }}
                />
            </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          <Suspense fallback={<LoadingFallback />}>
            {activeTab === 'dashboard' && (
                <div className="space-y-8 animate-[fadeIn_0.5s_ease-out]">
                    <div className="flex justify-between items-end border-b border-slate-800 pb-6">
                        <div>
                            {/* --- THE GREETING + RAIN BUTTON --- */}
                            <div className="flex items-center gap-4 mb-2">
                                <h2 className="text-3xl font-bold text-white">{getGreeting()}</h2>
                                <button 
                                    onClick={() => confetti({
                                        particleCount: 100,
                                        spread: 70,
                                        origin: { y: 0.3 },
                                        shapes: ['circle'],
                                        colors: ['#60a5fa', '#3b82f6', '#2563eb'], // Water vibes!
                                        scalar: 1.5,
                                        ticks: 60
                                    })}
                                    className="p-2 rounded-full bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-lg shadow-blue-500/10"
                                    title="Make it rain"
                                >
                                    🌧️
                                </button>
                            </div>
                            <p className="text-slate-400">Here is your focus for {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}.</p>
                        </div>
                        <div className="flex gap-4 text-sm text-slate-500">
                             <span>{state.tasks.filter((t:any) => !t.archived && t.status !== 'Done').length} Pending Tasks</span>
                             <span>•</span>
                             <span>{state.projects.filter((p:any) => p.status !== 'Done').length} Active Projects</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* TASKS */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertCircle size={18} className="text-blue-400" />
                                <h3 className="font-bold text-slate-200 uppercase text-sm tracking-wider">Priority Tasks (Today & Overdue)</h3>
                            </div>
                            
                            {todaysTasks.length === 0 ? (
                                <div className="glass p-8 rounded-2xl text-center border border-dashed border-slate-800">
                                    <p className="text-slate-500 italic">All clear, Hanna! Time for a matcha? 🍵</p>
                                    <button onClick={() => setActiveTab('tasks')} className="mt-4 text-blue-400 text-sm font-bold hover:text-blue-300">View Backlog →</button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {todaysTasks.map((t:any) => {
                                        const isOverdue = t.dueDate < getToday();
                                        return (
                                            <div 
                                                key={t.id} 
                                                onClick={() => { setFocusTaskId(t.id); setActiveTab('tasks'); }}
                                                className={`glass p-4 rounded-xl cursor-pointer group hover:bg-slate-800 transition-all border-l-4 ${isOverdue ? 'border-red-500' : 'border-blue-500'}`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="font-bold text-slate-200 group-hover:text-white">{t.title}</h4>
                                                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                                            {t.project && <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-400">{state.projects.find((p:any) => p.id === t.project)?.name}</span>}
                                                            <span className={`${isOverdue ? 'text-red-400 font-bold' : ''}`}>
                                                                {isOverdue ? 'Overdue (' + t.dueDate + ')' : 'Due Today'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <ArrowRight size={16} className="text-slate-600 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all" />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* RECENT FILES */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock size={18} className="text-purple-400" />
                                <h3 className="font-bold text-slate-200 uppercase text-sm tracking-wider">Recent Work</h3>
                            </div>

                            {recentFiles.length === 0 ? (
                                <p className="text-slate-500 text-sm italic">No docs or whiteboards created yet.</p>
                            ) : (
                                <div className="glass rounded-2xl overflow-hidden">
                                    {recentFiles.map((item:any, i:number) => (
                                        <div 
                                            key={item.id} 
                                            onClick={() => setActiveTab(item.type === 'doc' ? 'docs' : 'whiteboard')}
                                            className={`p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors ${i !== recentFiles.length - 1 ? 'border-b border-slate-800/50' : ''}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${item.type === 'doc' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
                                                    <item.icon size={18} />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-slate-300">{item.title || item.name}</div>
                                                    <div className="text-xs text-slate-500">Edited {item.lastUpdated || 'Unknown'}</div>
                                                </div>
                                            </div>
                                            <ArrowRight size={14} className="text-slate-600" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'tasks' && (
                <TaskManager 
                    data={state} 
                    dispatch={dispatch} 
                    focusTaskId={focusTaskId} 
                    clearFocus={() => setFocusTaskId(null)} 
                />
            )}
            
            {activeTab === 'projects' && (
                <ProjectsHub 
                    data={state} 
                    dispatch={dispatch} 
                    onNavigateToDoc={(id: string) => { setFocusDocId(id); setActiveTab('docs'); }} 
                    onNavigateToBoard={(id: string) => { setFocusBoardId(id); setActiveTab('whiteboard'); }} 
                />
            )}
            
            {activeTab === 'docs' && (
                <DocsModule 
                    data={state} 
                    projects={state.projects} 
                    dispatch={dispatch} 
                    focusDocId={focusDocId}
                    clearFocus={() => setFocusDocId(null)}
                />
            )}
            
            {activeTab === 'whiteboard' && (
                <WhiteboardModule 
                    data={state} 
                    dispatch={dispatch}
                    focusBoardId={focusBoardId}
                    clearFocus={() => setFocusBoardId(null)}
                />
            )}
            
            {activeTab === 'settings' && <SettingsModule data={state} dispatch={dispatch} />}
          </Suspense>
        </div>
      </main>
      
      {/* --- QUICK TASK FLOATING MODAL (ALT + N) --- */}
      {isQuickTaskOpen && (
        <div className="fixed inset-0 z-[999] flex items-start justify-center pt-[20vh] bg-slate-950/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-[fadeIn_0.1s_ease-out]">
                <div className="flex items-center px-4 py-3 bg-slate-800/50 border-b border-slate-700">
                    <Plus size={18} className="text-blue-400 mr-3 shrink-0" />
                    <input 
                        autoFocus
                        type="text"
                        placeholder="Quick Add Task... (Press Enter to save)"
                        className="w-full bg-transparent text-lg text-white placeholder-slate-500 focus:outline-none"
                        onKeyDown={(e: any) => {
                            if (e.key === 'Enter' && e.target.value.trim()) {
                                dispatch({ 
                                    type: 'ADD_TASK', 
                                    payload: { 
                                        title: e.target.value.trim(), 
                                        ice: 5, 
                                        dueDate: getToday() // <-- Defaults to Today!
                                    } 
                                });
                                confetti({ particleCount: 30, spread: 50, origin: { y: 0.2 } });
                                setIsQuickTaskOpen(false); // Close modal instantly
                            }
                        }}
                    />
                    <button onClick={() => setIsQuickTaskOpen(false)} className="text-slate-500 hover:text-white ml-2 shrink-0">
                        <X size={18} />
                    </button>
                </div>
                <div className="px-4 py-2 bg-slate-900 text-[10px] text-slate-500 flex justify-between font-mono">
                    <span>Date defaults to Today.</span>
                    <span>Press <kbd className="bg-slate-800 px-1 py-0.5 rounded text-slate-400">ESC</kbd> to close</span>
                </div>
            </div>
        </div>
      )}

      {/* SHUTDOWN WIZARD OVERLAY */}
      <ShutdownWizard 
        isOpen={isShutdownOpen}
        onClose={() => setIsShutdownOpen(false)} 
        tasks={state.tasks} 
        dispatch={dispatch}
      />

      <button onClick={() => signOut(auth)} className="fixed bottom-4 left-4 z-50 text-xs text-slate-500 hover:text-white flex items-center gap-2">
        <LogOut size={14} /> Sign Out
      </button>
    </div>
  );
}

export default App;