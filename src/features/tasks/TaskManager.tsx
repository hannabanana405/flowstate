import { useState, useEffect, useRef } from 'react';
import { 
  Search, Plus, RefreshCcw, Archive, Trash2, Repeat, ChevronLeft, ChevronRight,
  ChevronDown, X
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import confetti from 'canvas-confetti';

// --- UTILS (FIXED FOR LOCAL TIMEZONE) ---
const toLocalISOString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getToday = () => toLocalISOString(new Date());

const addDays = (d: string, n: number) => {
    // Adding T12:00:00 forces midday so the timezone shift can't roll it back a day!
    const date = new Date(d + 'T12:00:00'); 
    date.setDate(date.getDate() + n);
    return toLocalISOString(date);
};

const getEndOfWeek = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() + (7 - day);
    const endOfWeek = new Date(today.setDate(diff));
    return toLocalISOString(endOfWeek);
};

// --- RECURRENCE HELPER ---
const calculateNextDate = (currentDate: string, recurrence: string) => {
    const date = new Date(currentDate + 'T12:00:00'); // Force midday to avoid timezone shifts
    
    switch (recurrence) {
        case 'Daily': date.setDate(date.getDate() + 1); break;
        case 'Weekly': date.setDate(date.getDate() + 7); break;
        case 'Bi-Weekly': date.setDate(date.getDate() + 14); break;
        case 'Monthly': date.setMonth(date.getMonth() + 1); break;
    }
    return toLocalISOString(date);
};

export const TaskManager = ({ data, dispatch, focusTaskId, clearFocus }: any) => {
  const [filter, setFilter] = useState('All');
  const [projectFilter, setProjectFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('Today'); // "Today" is default
  const [search, setSearch] = useState('');
  
  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10; 

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [modalTab, setModalTab] = useState('details');

  // --- PROJECT PICKER STATE ---
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
  const [projectPickerSearch, setProjectPickerSearch] = useState('');
  const projectPickerRef = useRef<HTMLDivElement>(null);

  // Handle Focus from Dashboard
  useEffect(() => {
    if (focusTaskId) {
      const task = data.tasks.find((t: any) => t.id === focusTaskId);
      if (task) {
        setEditingTask({ ...task });
        setModalTab('details');
        setIsModalOpen(true);
      }
      if (clearFocus) clearFocus();
    }
  }, [focusTaskId, data.tasks, clearFocus]);

// Reset page when filters change
  useEffect(() => {
      setCurrentPage(1);
  }, [filter, projectFilter, dateFilter, search]);
  // Close picker when clicking outside
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (projectPickerRef.current && !projectPickerRef.current.contains(event.target as Node)) {
              setIsProjectPickerOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateNewProject = () => {
      const name = prompt("New Project Name:");
      if (name) {
        const newId = crypto.randomUUID();
        dispatch({ type: 'ADD_PROJECT', payload: { id: newId, name, status: 'On Track' } });
        setEditingTask({ ...editingTask, project: newId });
        setIsProjectPickerOpen(false);
        setProjectPickerSearch('');
      }
  };

  const triggerConfetti = () => {
      confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
      });
  };

  const saveTask = () => {
    if (!editingTask?.title) return;

    // --- HISTORY LOGIC ---
    const original = data.tasks.find((t: any) => t.id === editingTask.id);
    const changes: string[] = [];
    
    if (original) {
        // EXISTING TASK
        if (original.status !== editingTask.status) {
            changes.push(`Status changed from '${original.status}' to '${editingTask.status}'`);
        }
        if (editingTask.statusNote && original.statusNote !== editingTask.statusNote) {
             changes.push(`Note: ${editingTask.statusNote}`);
        } else if (original.priority !== editingTask.priority) {
             changes.push(`Priority changed to ${editingTask.priority}`);
        }
    } else {
        // NEW TASK
        changes.push("Task Created");
        if (editingTask.statusNote) {
            changes.push(`Note: ${editingTask.statusNote}`);
        }
    }

    if (changes.length > 0) {
        const now = new Date();
        const historyEntry = {
            date: now.toLocaleDateString(),
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            changes: changes
        };
        editingTask.history = [historyEntry, ...(editingTask.history || [])];
    }

    // --- RECURRENCE ENGINE (THE RECYCLER) ---
    if (original && original.status !== 'Done' && editingTask.status === 'Done' && editingTask.recurrence && editingTask.recurrence !== 'None') {
        const nextDate = calculateNextDate(editingTask.dueDate, editingTask.recurrence);
        
        // Instead of making a new task, we instantly mutate this one and bounce it forward!
        // No database bloat, and the "old" one effectively ceases to exist.
        editingTask.status = 'Not Started';
        editingTask.dueDate = nextDate;
        editingTask.statusNote = `Recycled! Next due: ${nextDate}`;
    }

    // Save
    editingTask.id 
      ? dispatch({ type: 'UPDATE_TASK', payload: editingTask }) 
      : dispatch({ type: 'ADD_TASK', payload: editingTask });
      
    setIsModalOpen(false);
  };

  // --- SHORTCUT LISTENER ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isModalOpen) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        saveTask();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, editingTask]); 

  // Filter Logic
  const filtered = data.tasks.filter((t: any) => {
    if (filter === 'Archived') return t.archived;
    if (t.archived) return false;
    
    const matchesStatus = filter === 'All' || t.status === filter;
    const matchesProject = projectFilter === 'All' || t.project === projectFilter;
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase());
    
    let matchesDate = true;
    if (dateFilter !== 'All') {
        if (!t.dueDate) matchesDate = false;
        else {
            const today = getToday();
            if (dateFilter === 'Today') {
                matchesDate = t.dueDate === today || (t.dueDate < today && t.status !== 'Done');
            }
            else if (dateFilter === 'Tomorrow') matchesDate = t.dueDate === addDays(today, 1);
            else if (dateFilter === 'This Week') matchesDate = t.dueDate >= today && t.dueDate <= getEndOfWeek();
            else if (dateFilter === 'Future') matchesDate = t.dueDate > getEndOfWeek();
            else if (dateFilter === 'Overdue') matchesDate = t.dueDate < today && t.status !== 'Done';
        }
    }

return matchesStatus && matchesProject && matchesSearch && matchesDate;
  });

// --- ICE SORTING LOGIC ---
  const sortedAndFiltered = [...filtered].sort((a, b) => {
      // Default to 1 if not scored yet
      const scoreA = (a.ice?.impact || 1) * (a.ice?.confidence || 1) * (a.ice?.ease || 1);
      const scoreB = (b.ice?.impact || 1) * (b.ice?.confidence || 1) * (b.ice?.ease || 1);
      return scoreB - scoreA; // Highest score sits at the top!
  });

  // --- PAGINATION CALCULATION ---
  const totalPages = Math.ceil(sortedAndFiltered.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTasks = sortedAndFiltered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

const openNewTask = () => {
      setEditingTask({ 
          title: '', status: 'Not Started', priority: 'Medium', 
          dueDate: getToday(), project: '', tags: [], notes: '', statusNote: '', history: [],
          ice: { impact: 1, confidence: 1, ease: 1 } // <--- ADDED DEFAULT ICE
      });
      setModalTab('details');
      setIsModalOpen(true);
  };

  // Filter projects for the picker modal
  const pickerFilteredProjects = data.projects.filter((p:any) => 
    p.name.toLowerCase().includes(projectPickerSearch.toLowerCase()) && p.status !== 'Done'
  );
  
  const selectedProjectName = data.projects.find((p:any) => p.id === editingTask?.project)?.name || "-- No Project --";

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Controls Header */}
      <div className="flex justify-between items-center gap-4">
{/* Search Bar with Clear Button */}
            <div className="relative flex items-center">
                <Search className="absolute left-3 text-slate-500" size={16} />
                <input 
                    type="text" 
                    placeholder="Search tasks..." 
                    value={search} // (Make sure this matches your search state variable name)
                    onChange={e => setSearch(e.target.value)} 
                    className="w-64 bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-10 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-all" 
                />
                {search && (
                    <button 
                        onClick={() => setSearch('')} 
                        className="absolute right-3 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>
        
        <div className="flex items-center gap-2">
            <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="bg-slate-900 border border-slate-800 text-slate-300 py-3 px-4 rounded-xl focus:outline-none focus:border-blue-500 text-sm">
                <option value="All">All Projects</option>
                {data.projects.filter((p:any) => p.status !== 'Done').map((p:any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>

            <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="bg-slate-900 border border-slate-800 text-slate-300 py-3 px-4 rounded-xl focus:outline-none focus:border-blue-500 text-sm">
                <option value="All">Any Date</option>
                <option value="Today">Today (+ Overdue)</option>
                <option value="Tomorrow">Tomorrow</option>
                <option value="This Week">This Week</option>
                <option value="Future">Future</option>
                <option value="Overdue" className="text-red-400 font-bold">! Overdue Only</option>
            </select>


            <button onClick={openNewTask} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20 ml-2">
                <Plus size={20} /> Add Task
            </button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
          {['All', 'Not Started', 'In Progress', 'Blocked', 'Done', 'Archived'].map(s => {
              const isActive = filter === s;
              return (
                  <button 
                    key={s} 
                    onClick={() => setFilter(s)} 
                    className={`px-5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${isActive ? 'bg-white text-slate-950' : 'border border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'}`}
                  >
                      {s}
                  </button>
              );
          })}
      </div>

      {/* Task Table */}
      <div className="flex-1 bg-slate-900/50 border border-slate-800/50 rounded-2xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-slate-800/50">
                        <th className="p-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Task</th>
                        <th className="p-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Project</th>
                        <th className="p-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="p-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Due</th>
                        <th className="p-5 text-xs font-bold text-slate-500 uppercase tracking-wider">ICE</th>
                        <th className="p-5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                    {paginatedTasks.map((t:any) => (
                        <tr key={t.id} className="group hover:bg-slate-800/30 transition-colors">
                            <td 
                                className="p-5 font-semibold text-slate-200 cursor-pointer hover:text-blue-400 transition-colors"
                                onClick={() => { setEditingTask({ ...t }); setModalTab('details'); setIsModalOpen(true); }}
                            >
                                {t.title}
                                {t.recurrence && t.recurrence !== 'None' && (
                                    <span className="ml-2 inline-block text-blue-400" title={`Repeats ${t.recurrence}`}>
                                        <Repeat size={14} />
                                    </span>
                                )}
                            </td>
                            <td className="p-5">
                                {t.project ? (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                        {data.projects.find((p:any) => p.id === t.project)?.name || 'Unknown'}
                                    </span>
                                ) : (
                                    <span className="text-slate-600 text-xs italic">No Project</span>
                                )}
                            </td>
                            <td className="p-5">
                                <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-medium border ${
                                    t.status === 'Done' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                                    t.status === 'In Progress' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 
                                    t.status === 'Blocked' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                                    'bg-slate-800 text-slate-400 border-slate-700'
                                }`}>
                                    {t.status}
                                </span>
                            </td>
                            <td className={`p-5 text-sm ${t.dueDate < getToday() && t.status !== 'Done' ? 'text-red-400 font-bold' : 'text-slate-400'}`}>
                                {t.dueDate}
                                {t.dueDate < getToday() && t.status !== 'Done' && <span className="text-xs ml-1">(Late)</span>}
                            </td>
                            <td className="p-5">
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-black text-xs shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                                    {(t.ice?.impact || 1) * (t.ice?.confidence || 1) * (t.ice?.ease || 1)}
                                </span>
                            </td>
<td className="p-5 text-right">
                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {/* --- NEW BUMP BUTTON --- */}
                                    <button 
                                        onClick={(e) => { 
                                            e.stopPropagation(); // Stops the modal from opening
                                            dispatch({ 
                                                type: 'UPDATE_TASK', 
                                                payload: { ...t, dueDate: addDays(getToday(), 1) } 
                                            }); 
                                        }} 
                                        className="p-2 text-slate-500 hover:text-amber-400"
                                        title="Bump to Tomorrow"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                    
                                    <button onClick={(e) => { 
                                        e.stopPropagation();
                                        if(!t.archived) triggerConfetti();
                                        dispatch({ type: t.archived ? 'RESTORE_TASK' : 'ARCHIVE_TASK', payload: t.id }); 
                                    }} className="p-2 text-slate-500 hover:text-blue-400">
                                        {t.archived ? <RefreshCcw size={16} /> : <Archive size={16} />}
                                    </button>
                                    
                                    <button onClick={(e) => { 
                                        e.stopPropagation();
                                        triggerConfetti(); 
                                        dispatch({ type: 'DELETE_TASK', payload: t.id }); 
                                    }} className="p-2 text-slate-500 hover:text-red-400">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {paginatedTasks.length === 0 && (
                        <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-500 italic">
                                All caught up for today! 🎉 (Or adjust your filters)
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

        {/* --- PAGINATION FOOTER --- */}
        {filtered.length > ITEMS_PER_PAGE && (
            <div className="border-t border-slate-800/50 p-4 flex items-center justify-between bg-slate-900/30">
                <div className="text-xs text-slate-500">
                    Showing {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filtered.length)} of {filtered.length} tasks
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg border border-slate-700 text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 hover:text-white transition-colors"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm text-slate-300 font-mono px-2">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg border border-slate-700 text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 hover:text-white transition-colors"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        )}
      </div>

      {/* Edit/Add Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingTask?.id ? "Edit Task" : "New Task"}
      >
        {editingTask && (
            <div className="space-y-6">
                {editingTask.id && (
                    <div className="flex gap-4 border-b border-slate-700 pb-2 mb-2">
                        <button onClick={() => setModalTab('details')} className={`text-sm font-bold pb-1 ${modalTab === 'details' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400'}`}>Details</button>
                        <button onClick={() => setModalTab('history')} className={`text-sm font-bold pb-1 ${modalTab === 'history' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400'}`}>History</button>
                    </div>
                )}

                {modalTab === 'details' ? (
                    <>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Task Title</label>
                            <input 
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none transition-colors" 
                                value={editingTask.title} 
                                onChange={e => setEditingTask({ ...editingTask, title: e.target.value })} 
                            />
                        </div>
<div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Status</label>
                            <select className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 focus:border-blue-500 focus:outline-none" value={editingTask.status} onChange={e => setEditingTask({ ...editingTask, status: e.target.value })}>
                                <option>Not Started</option>
                                <option>In Progress</option>
                                <option>Blocked</option>
                                <option>Done</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* --- SEARCHABLE PROJECT PICKER --- */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Project</label>
                                <div className="relative" ref={projectPickerRef}>
                                    <button 
                                        onClick={() => setIsProjectPickerOpen(!isProjectPickerOpen)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 focus:border-blue-500 focus:outline-none flex justify-between items-center"
                                    >
                                        <span className="truncate">{selectedProjectName}</span>
                                        <ChevronDown size={14} className="text-slate-500" />
                                    </button>

                                    {isProjectPickerOpen && (
                                        <div className="absolute top-full left-0 mt-2 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col animate-[fadeIn_0.1s_ease-out]">
                                            <div className="p-2 border-b border-slate-800">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
                                                    <input 
                                                        autoFocus
                                                        type="text" 
                                                        placeholder="Find project..." 
                                                        value={projectPickerSearch}
                                                        onChange={(e) => setProjectPickerSearch(e.target.value)}
                                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-2 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                                                    />
                                                </div>
                                            </div>
                                            <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
                                                <button onClick={() => { setEditingTask({...editingTask, project: ''}); setIsProjectPickerOpen(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-800 rounded-lg hover:text-white transition-colors">
                                                    -- No Project --
                                                </button>
                                                {pickerFilteredProjects.map((p:any) => (
                                                    <button 
                                                        key={p.id} 
                                                        onClick={() => { setEditingTask({...editingTask, project: p.id}); setIsProjectPickerOpen(false); }}
                                                        className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex justify-between items-center ${editingTask.project === p.id ? 'bg-blue-600/20 text-blue-400' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                                                    >
                                                        <span className="truncate">{p.name}</span>
                                                    </button>
                                                ))}
                                                {pickerFilteredProjects.length === 0 && (
                                                    <div className="px-3 py-2 text-xs text-slate-500 italic text-center">No projects found.</div>
                                                )}
                                            </div>
                                            <div className="p-2 border-t border-slate-800 bg-slate-900/50">
                                                <button onClick={handleCreateNewProject} className="w-full py-2 text-xs font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors flex items-center justify-center gap-2">
                                                    <Plus size={14} /> Create New Project
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Due Date</label>
                                <input 
                                    type="date" 
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none" 
                                    value={editingTask.dueDate} 
                                    onChange={e => setEditingTask({ ...editingTask, dueDate: e.target.value })} 
                                />
                            </div>
                        </div> 
                        {/* --- ICE SCORING --- */}
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">I.C.E. Score</h4>
                            
                            {[
                                { key: 'impact', label: 'Impact (1-5)' },
                                { key: 'confidence', label: 'Confidence (1-5)' },
                                { key: 'ease', label: 'Ease (1-5)' }
                            ].map(metric => (
                                <div key={metric.key} className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-slate-300">{metric.label}</span>
                                    <div className="flex gap-2">
                                        {[1, 2, 3, 4, 5].map(val => (
                                            <button
                                                key={val}
                                                onClick={() => setEditingTask({
                                                    ...editingTask,
                                                    ice: { ...(editingTask.ice || { impact:1, confidence:1, ease:1 }), [metric.key]: val }
                                                })}
                                                className={`w-6 h-6 rounded-full transition-all duration-200 ${
                                                    (editingTask.ice?.[metric.key] || 1) >= val 
                                                        ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)] scale-110' 
                                                        : 'bg-slate-800 hover:bg-slate-700'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                            
                            <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                                <span className="text-xs text-slate-500 font-bold uppercase">Total Priority Score</span>
                                <span className="text-2xl font-black text-blue-400">
                                    {(editingTask.ice?.impact || 1) * (editingTask.ice?.confidence || 1) * (editingTask.ice?.ease || 1)}
                                </span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Recurrence</label>
                            <select className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-300 focus:border-blue-500 focus:outline-none" value={editingTask.recurrence || 'None'} onChange={e => setEditingTask({ ...editingTask, recurrence: e.target.value })}>
                                <option value="None">No Recurrence</option>
                                <option value="Daily">Daily</option>
                                <option value="Weekly">Weekly</option>
                                <option value="Bi-Weekly">Bi-Weekly</option>
                                <option value="Monthly">Monthly</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Status Note (What changed?)</label>
                            <input className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none" placeholder="E.g. Fixed the bug..." value={editingTask.statusNote} onChange={e => setEditingTask({ ...editingTask, statusNote: e.target.value })} />
                        </div>

                        <button onClick={saveTask} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-900/20">
                            {editingTask.id ? 'Save Changes' : 'Create Task'}
                        </button>
                    </>
                ) : (
                    <div className="space-y-4 max-h-64 overflow-y-auto">
                        {!editingTask.history || editingTask.history.length === 0 ? <p className="text-slate-500 italic">No history yet.</p> : editingTask.history.map((h:any, i:number) => (
                            <div key={i} className="text-sm border-l-2 border-slate-700 pl-4 py-1">
                                <div className="text-xs text-slate-500 mb-1">{h.date} at {h.time}</div>
                                <ul className="list-disc list-inside text-slate-300 space-y-1">
                                    {h.changes?.map((change:string, idx:number) => <li key={idx}>{change}</li>)}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}
      </Modal>
    </div>
  );
};