import { useState, useEffect } from 'react';
import { 
  Search, Plus, ChevronRight, Calendar, Archive, RefreshCcw, 
  FileText, PenTool, Trash2, ChevronLeft, CheckSquare 
} from 'lucide-react';
import { Modal } from '../../components/Modal';

// --- UTILS (FIXED FOR LOCAL TIMEZONE) ---
const toLocalISOString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getToday = () => toLocalISOString(new Date());

const addDays = (d: string, n: number) => {
    const date = new Date(d);
    date.setDate(date.getDate() + n);
    return toLocalISOString(date);
};

export const ProjectsHub = ({ data, dispatch, onNavigateToDoc, onNavigateToBoard }: any) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [reminderData, setReminderData] = useState({ days: 3, note: '', customDate: '' });
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  // --- PAGINATION STATE (Archive Only) ---
  const [archivePage, setArchivePage] = useState(1);
  const ARCHIVE_ITEMS_PER_PAGE = 9; // 3x3 Grid
  
  // Dependency & Quick Task State
  const [newDep, setNewDep] = useState({ what: '', who: '' });
  const [quickTaskTitle, setQuickTaskTitle] = useState(''); 

  const activeProjects = data.projects.filter((p:any) => p.status !== 'Done');
  const archivedProjects = data.projects.filter((p:any) => p.status === 'Done');
  
  const filteredActive = activeProjects.filter((p:any) => p.name.toLowerCase().includes(search.toLowerCase()));
  const filteredArchived = archivedProjects.filter((p:any) => p.name.toLowerCase().includes(search.toLowerCase()));

  // Paginate Archived
  const totalArchivePages = Math.ceil(filteredArchived.length / ARCHIVE_ITEMS_PER_PAGE);
  const archiveStartIndex = (archivePage - 1) * ARCHIVE_ITEMS_PER_PAGE;
  const paginatedArchived = filteredArchived.slice(archiveStartIndex, archiveStartIndex + ARCHIVE_ITEMS_PER_PAGE);

  // Reset pagination on search
  useEffect(() => {
      setArchivePage(1);
  }, [search]);

  // SHORTCUT: CMD + ENTER to SAVE
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isModalOpen) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        // Only save project if we are NOT in the tasks tab (to prevent conflict with Quick Add)
        if (activeTab !== 'tasks') {
            e.preventDefault();
            saveProject();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, editingProject, activeTab]);

  const openProject = (p: any) => {
    dispatch({ type: 'TOUCH_PROJECT', payload: p.id });
    setEditingProject({ ...p });
    setActiveTab('overview');
    setIsModalOpen(true);
    setQuickTaskTitle(''); 
  };

  const saveProject = () => {
    if (!editingProject?.name) return;
    
    // --- HISTORY LOGIC ---
    const original = data.projects.find((p:any) => p.id === editingProject.id);
    let hasChanged = false;

    if (original) {
        // EXISTING PROJECT: Detect meaningful changes
        const statusChanged = original.status !== editingProject.status;
        const noteChanged = original.statusNote !== editingProject.statusNote;

        if (statusChanged || noteChanged) {
            hasChanged = true;
            const newHistoryEntry = {
                date: new Date().toLocaleDateString(),
                status: editingProject.status,
                note: editingProject.statusNote || 'Status updated' 
            };
            // Add to top of history
            editingProject.history = [newHistoryEntry, ...(editingProject.history || [])];
        }
    } else {
        // NEW PROJECT: Use the Status Note as the first entry!
        editingProject.history = [{
            date: new Date().toLocaleDateString(),
            status: editingProject.status,
            note: editingProject.statusNote || 'Project Created' 
        }];
    }

    // Save Logic
    editingProject.id 
      ? dispatch({ type: 'UPDATE_PROJECT', payload: editingProject }) 
      : dispatch({ type: 'ADD_PROJECT', payload: editingProject });
      
    setIsModalOpen(false);
    
    // --- REMINDER TRIGGER ---
    if (hasChanged && editingProject.status !== 'Done') {
        setReminderData(prev => ({ 
            ...prev, 
            note: `Follow up: ${editingProject.name}` 
        }));
        setIsReminderOpen(true);
    }
  };

  const deleteProject = () => {
      if (confirm(`Are you sure you want to PERMANENTLY delete "${editingProject.name}"? This cannot be undone and will remove all associated data.`)) {
          dispatch({ type: 'DELETE_PROJECT', payload: editingProject.id });
          setIsModalOpen(false);
      }
  };

  const addDependency = () => {
     if(!newDep.what) return;
     const newDeps = [...(editingProject.dependencies || []), { id: crypto.randomUUID(), what: newDep.what, who: newDep.who }];
     const updatedProject = { ...editingProject, dependencies: newDeps };
     
     setEditingProject(updatedProject);
     dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
     setNewDep({ what: '', who: '' });
  };

  // --- QUICK ADD TASK LOGIC ---
  const quickAddTask = () => {
      if (!quickTaskTitle.trim()) return;

      const newId = crypto.randomUUID();
      const now = new Date();
      
      dispatch({ 
          type: 'ADD_TASK', 
          payload: { 
              id: newId, 
              title: quickTaskTitle, 
              project: editingProject.id, 
              status: 'Not Started', 
              priority: 'Medium', // Default
              dueDate: getToday(), // Default to Today
              history: [{
                  date: now.toLocaleDateString(),
                  time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  changes: ['Task Created via Project Hub']
              }]
          } 
      });
      
      setQuickTaskTitle(''); 
  };

  const createReminder = () => {
    const dueDate = reminderData.customDate ? reminderData.customDate : addDays(getToday(), typeof reminderData.days === 'number' ? reminderData.days : 0);
    
    dispatch({ type: 'ADD_TASK', payload: { 
        title: reminderData.note || `Follow up: ${editingProject.name}`, 
        dueDate: dueDate, 
        priority: 'Medium', 
        project: editingProject.id, 
        notes: '' 
    }});

    setIsReminderOpen(false);
  };

  // --- NEW CREATE HANDLERS ---
  const createLinkedDoc = () => {
      const newId = crypto.randomUUID();
      dispatch({ type: 'ADD_DOC', payload: { id: newId, title: `Notes: ${editingProject.name}`, projectId: editingProject.id, content: '' } });
      onNavigateToDoc(newId);
      setIsModalOpen(false);
  };

  const createLinkedBoard = () => {
      const newId = crypto.randomUUID();
      const today = new Date().toLocaleDateString();
      dispatch({ type: 'ADD_WHITEBOARD', payload: { id: newId, name: `Board: ${editingProject.name}`, projectId: editingProject.id, createdAt: today, lastUpdated: today } });
      onNavigateToBoard(newId);
      setIsModalOpen(false);
  };

  const getProgress = (pid: string) => {
      const tasks = data.tasks.filter((t:any) => t.project === pid && !t.archived);
      if (tasks.length === 0) return 0;
      return Math.round(tasks.filter((t:any) => t.status === 'Done').length / tasks.length * 100);
  };

  const linkedDocs = editingProject ? data.docs.filter((d:any) => d.projectId === editingProject.id) : [];
  const linkedBoards = editingProject ? data.whiteboards.filter((w:any) => w.projectId === editingProject.id) : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Projects</h2>
        <div className="flex gap-4 items-center">
            <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                <input type="text" placeholder="Find a project..." value={search} onChange={e => setSearch(e.target.value)} className="w-64 bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-all" />
            </div>
            <button onClick={() => { setEditingProject({ name: '', status: 'On Track', statusNote: '', blockers: [], history: [], dependencies: [] }); setIsModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex gap-2 items-center">
                <Plus size={16} /> New Project
            </button>
        </div>
      </div>

      {/* Grid (Active Projects) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredActive.length === 0 && activeProjects.length > 0 && <p className="text-slate-500 col-span-3 text-center italic">No projects found matching "{search}".</p>}
        
        {filteredActive.map((p:any) => (
            <div key={p.id} onClick={() => openProject(p)} className="glass p-6 rounded-2xl group border-t border-white/5 hover:border-blue-500/30 cursor-pointer transition-all">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">{p.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${p.status === 'At Risk' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{p.status}</span>
                </div>
                <div className="mb-4">
                    <div className="w-full bg-slate-800 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${getProgress(p.id)}%` }}></div>
                    </div>
                </div>
                <p className="text-xs text-slate-400 italic truncate">"{p.statusNote || 'No status note'}"</p>
            </div>
        ))}
      </div>

      {/* Archive Section */}
      {archivedProjects.length > 0 && (
          <div className="mt-12 pt-8 border-t border-slate-800/50">
              <button onClick={() => setIsArchiveOpen(!isArchiveOpen)} className="flex items-center gap-3 w-full text-left group">
                  <div className={`p-2 rounded-lg bg-slate-800 group-hover:bg-slate-700 transition-all duration-300 ${isArchiveOpen ? 'rotate-90 text-blue-400' : 'text-slate-400'}`}>
                      <ChevronRight size={20} />
                  </div>
                  <div>
                      <h3 className="text-lg font-bold text-slate-300 group-hover:text-white transition-colors">Project Archive</h3>
                      <p className="text-xs text-slate-500">{archivedProjects.length} projects completed</p>
                  </div>
              </button>
              
              {isArchiveOpen && (
                  <div className="animate-[fadeIn_0.3s_ease-out] mt-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {paginatedArchived.map((p:any) => (
                              <div key={p.id} onClick={() => openProject(p)} className="glass p-5 rounded-xl cursor-pointer opacity-75 hover:opacity-100 transition-all border border-slate-800 hover:border-slate-600 group">
                                  <div className="flex justify-between items-start mb-2">
                                      <div className="font-bold text-slate-400 group-hover:text-slate-200 transition-colors">{p.name}</div>
                                      <span className="bg-slate-800 text-slate-500 text-[10px] px-2 py-1 rounded-full uppercase tracking-wider font-bold">Done</span>
                                  </div>
                                  <div className="text-xs text-slate-600 mb-3 flex items-center gap-1">
                                      <Calendar size={12} /> Last updated: {p.lastUpdated}
                                  </div>
                              </div>
                          ))}
                      </div>

                      {filteredArchived.length > ARCHIVE_ITEMS_PER_PAGE && (
                        <div className="flex items-center justify-center gap-4 mt-6">
                            <button onClick={() => setArchivePage(p => Math.max(1, p - 1))} disabled={archivePage === 1} className="p-2 rounded-lg border border-slate-700 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 hover:text-white transition-colors">
                                <ChevronLeft size={18} />
                            </button>
                            <span className="text-sm text-slate-400 font-mono">Page {archivePage} of {totalArchivePages}</span>
                            <button onClick={() => setArchivePage(p => Math.min(totalArchivePages, p + 1))} disabled={archivePage === totalArchivePages} className="p-2 rounded-lg border border-slate-700 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 hover:text-white transition-colors">
                                <ChevronRight size={18} />
                            </button>
                        </div>
                      )}
                  </div>
              )}
          </div>
      )}

      {/* Project Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingProject?.name || "New Project"}
      >
        {editingProject && (
            <div className="space-y-6">
                <div className="flex gap-2 border-b border-slate-700 pb-2 overflow-x-auto">
                    {['Overview', 'Resources', 'History', 'Dependencies', 'Tasks'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab.toLowerCase())} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === tab.toLowerCase() ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>{tab}</button>
                    ))}
                </div>

                {activeTab === 'overview' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Project Name</label>
                            <input className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-blue-500 focus:outline-none" value={editingProject.name} onChange={e => setEditingProject({ ...editingProject, name: e.target.value })} />
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-1/2">
                                <select className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-300 focus:border-blue-500 focus:outline-none" value={editingProject.status} onChange={e => setEditingProject({ ...editingProject, status: e.target.value })}>
                                    <option>On Track</option>
                                    <option>At Risk</option>
                                    <option>Off Track</option>
                                    <option>Done</option>
                                </select>
                            </div>
                            <div className="text-slate-500 text-sm italic">Last Updated: {editingProject.lastUpdated}</div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Current Status Update</label>
                            <textarea className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-300 focus:border-blue-500 focus:outline-none resize-none" rows={4} value={editingProject.statusNote} onChange={e => setEditingProject({ ...editingProject, statusNote: e.target.value })} />
                        </div>
                        <button onClick={saveProject} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20">Update Status</button>
                        
                        <div className="pt-4 mt-4 border-t border-slate-800/50 flex flex-col gap-3">
                            {editingProject.status !== 'Done' ? (
                                <button onClick={() => { dispatch({ type: 'UPDATE_PROJECT', payload: { ...editingProject, status: 'Done' } }); setIsModalOpen(false); }} className="text-slate-500 hover:text-blue-400 text-sm font-bold flex items-center justify-center gap-2 w-full py-2 transition-colors">
                                    <Archive size={16} /> Archive Project
                                </button>
                            ) : (
                                <button onClick={() => { dispatch({ type: 'UPDATE_PROJECT', payload: { ...editingProject, status: 'On Track' } }); setIsModalOpen(false); }} className="text-slate-500 hover:text-blue-400 text-sm font-bold flex items-center justify-center gap-2 w-full py-2 transition-colors">
                                    <RefreshCcw size={16} /> Restore Project
                                </button>
                            )}
                            <button onClick={deleteProject} className="text-slate-600 hover:text-red-500 text-xs uppercase font-bold tracking-wider py-2 transition-colors flex items-center justify-center gap-2">
                                <Trash2 size={14} /> Delete Project Permanently
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'dependencies' && (
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <input value={newDep.what} onChange={e => setNewDep({...newDep, what: e.target.value})} placeholder="Blocker description..." className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:outline-none focus:border-blue-500 text-slate-200" />
                            <input value={newDep.who} onChange={e => setNewDep({...newDep, who: e.target.value})} placeholder="Who?" className="w-1/3 bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:outline-none focus:border-blue-500 text-slate-200" />
                            <button onClick={addDependency} className="bg-slate-800 hover:bg-slate-700 px-4 rounded-lg text-slate-300">
                                <Plus size={20} />
                            </button>
                        </div>
                        <div className="space-y-2">
                            {editingProject.dependencies?.map((d:any) => (
                                <div key={d.id} className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg border-l-4 border-amber-500">
                                    <div>
                                        <div className="text-sm text-slate-200">{d.what}</div>
                                        <div className="text-xs text-slate-500">Owner: {d.who}</div>
                                    </div>
                                    <button onClick={() => {
                                        const newDeps = editingProject.dependencies.filter((x:any) => x.id !== d.id);
                                        setEditingProject({ ...editingProject, dependencies: newDeps });
                                        dispatch({ type: 'UPDATE_PROJECT', payload: { ...editingProject, dependencies: newDeps } });
                                    }} className="text-slate-600 hover:text-red-400">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {activeTab === 'resources' && (
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-xs font-bold text-slate-500 uppercase">Linked Docs</h4>
                                <button onClick={createLinkedDoc} className="text-xs text-blue-400 hover:text-white flex items-center gap-1 font-bold">
                                    <Plus size={12} /> Add New Doc
                                </button>
                            </div>
                            {linkedDocs.length === 0 ? <p className="text-sm text-slate-600 italic">No docs linked.</p> : linkedDocs.map((d:any) => (
                                <div key={d.id} onClick={() => { onNavigateToDoc(d.id); setIsModalOpen(false); }} className="p-3 bg-slate-800 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-slate-700 mb-2 border border-slate-700">
                                    <FileText size={16} className="text-blue-400" /> <span className="text-slate-300">{d.title}</span>
                                </div>
                            ))}
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-xs font-bold text-slate-500 uppercase">Linked Whiteboards</h4>
                                <button onClick={createLinkedBoard} className="text-xs text-purple-400 hover:text-white flex items-center gap-1 font-bold">
                                    <Plus size={12} /> Add New Board
                                </button>
                            </div>
                            {linkedBoards.length === 0 ? <p className="text-sm text-slate-600 italic">No boards linked.</p> : linkedBoards.map((w:any) => (
                                <div key={w.id} onClick={() => { onNavigateToBoard(w.id); setIsModalOpen(false); }} className="p-3 bg-slate-800 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-slate-700 mb-2 border border-slate-700">
                                    <PenTool size={16} className="text-purple-400" /> <span className="text-slate-300">{w.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                        {editingProject.history?.length ? editingProject.history.map((h:any, i:number) => (
                            <div key={i} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                <div className="flex justify-between text-xs text-slate-400 mb-1">
                                    <span>{h.date}</span>
                                    <span className={`px-2 py-0.5 rounded ${h.status === 'At Risk' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{h.status}</span>
                                </div>
                                <p className="text-sm text-slate-200">{h.note}</p>
                            </div>
                        )) : <p className="text-slate-500 italic text-center py-4">No history yet.</p>}
                    </div>
                )}

                {activeTab === 'tasks' && (
                    <div className="space-y-4">
                        {/* QUICK ADD ROW */}
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <CheckSquare className="absolute left-3 top-3 text-slate-500" size={16} />
                                <input 
                                    value={quickTaskTitle}
                                    onChange={(e) => setQuickTaskTitle(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && quickAddTask()}
                                    placeholder="Add a new task..." 
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-slate-600 transition-all"
                                />
                            </div>
                            <button onClick={quickAddTask} className="bg-slate-800 hover:bg-slate-700 px-4 rounded-xl text-slate-300 transition-colors">
                                <Plus size={20} />
                            </button>
                        </div>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {data.tasks.filter((t:any) => t.project === editingProject.id).length ? data.tasks.filter((t:any) => t.project === editingProject.id).map((t:any) => (
                                <div key={t.id} className="p-3 bg-slate-800/50 rounded-lg flex justify-between items-center border border-slate-800 hover:border-slate-700">
                                    <span className="text-sm font-medium text-slate-300">{t.title}</span>
                                    <span className={`text-xs px-2 py-1 rounded ${t.status === 'Done' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 bg-slate-800'}`}>{t.status}</span>
                                </div>
                            )) : <p className="text-slate-500 italic text-center py-4">No linked tasks.</p>}
                        </div>
                    </div>
                )}
            </div>
        )}
      </Modal>

      {/* Reminder Modal */}
      <Modal isOpen={isReminderOpen} onClose={() => setIsReminderOpen(false)} title="Set Follow-Up?">
        <div className="space-y-4">
            <p className="text-slate-300">Project updated. Create a reminder task?</p>
            <div className="flex gap-2 items-center mb-2">
                <Calendar size={16} className="text-slate-500" />
                <span className="text-xs uppercase font-bold text-slate-500">Quick Select or Pick Date</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
                {[1, 3, 5, 14].map((d) => (
                    <button key={d} onClick={() => setReminderData({ ...reminderData, days: d, customDate: '' })} className={`p-2 rounded border text-sm transition-all ${reminderData.days === d && !reminderData.customDate ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}>+{d} Days</button>
                ))}
            </div>
            <div className="relative">
                {/* Updated White Background Input */}
                <input 
                    type="date" 
                    className={`w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-blue-500 transition-colors ${reminderData.customDate ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-300'}`} 
                    value={reminderData.customDate} 
                    onChange={e => setReminderData({ ...reminderData, customDate: e.target.value, days: 0 })} 
                />
            </div>
            <input value={reminderData.note} onChange={e => setReminderData({ ...reminderData, note: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white mt-2" placeholder="Task Title..." />
            <div className="flex gap-2 mt-2">
                <button onClick={createReminder} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20">Yes, Add Task</button>
                <button onClick={() => setIsReminderOpen(false)} className="px-4 text-slate-500 hover:text-white">No</button>
            </div>
        </div>
      </Modal>
    </div>
  );
};