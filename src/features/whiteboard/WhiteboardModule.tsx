import { useState, useEffect, useCallback, useRef } from 'react'; // Removed useMemo
import { Tldraw, Editor, getSnapshot, loadSnapshot } from 'tldraw';
import 'tldraw/tldraw.css';
import { Trash2, Plus, Link, Calendar, Clock, Search, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

export const WhiteboardModule = ({ data, dispatch, focusBoardId, clearFocus }: any) => {
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  
  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  // --- PROJECT PICKER STATE ---
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const projectPickerRef = useRef<HTMLDivElement>(null);
  
  const saveTimeoutRef = useRef<any>(null);

  // [DELETED] The manual assetUrls block was here. Removing it fixes the crash.

  // 0. HANDLE FOCUS
  useEffect(() => {
    if (focusBoardId) {
        setSelectedBoardId(focusBoardId);
        if (clearFocus) clearFocus();
    }
  }, [focusBoardId, clearFocus]);

  // 2. Select first board on load
  useEffect(() => {
    if (!selectedBoardId && !focusBoardId && data.whiteboards.length > 0) {
      setSelectedBoardId(data.whiteboards[0].id);
    }
  }, [data.whiteboards, selectedBoardId, focusBoardId]);

  // Reset pagination on search
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

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

  // FILTER & PAGINATION LOGIC
  const filteredBoards = data.whiteboards.filter((wb: any) => 
    wb.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredBoards.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedBoards = filteredBoards.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const activeBoard = data.whiteboards.find((w:any) => w.id === selectedBoardId);
  const activeProject = data.projects.find((p:any) => p.id === activeBoard?.projectId);

  // Filter projects for picker
  const pickerFilteredProjects = data.projects.filter((p:any) => 
      p.name.toLowerCase().includes(projectSearch.toLowerCase())
  );

  // 3. Handle Mounting
  const handleMount = useCallback((editorInstance: Editor) => {
    // Load Data
    if (activeBoard?.snapshot) {
      try {
        loadSnapshot(editorInstance.store, activeBoard.snapshot);
      } catch (e) {
        console.error("Failed to load snapshot", e);
        editorInstance.store.clear();
      }
    }

    const handleChange = () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        if (!editorInstance) return;
        const { document, session } = getSnapshot(editorInstance.store);
        
        // UPDATE TIMESTAMP LOGIC
        dispatch({ 
          type: 'UPDATE_WHITEBOARD', 
          payload: { 
              id: activeBoard.id, 
              snapshot: { document, session },
              lastUpdated: new Date().toLocaleDateString()
          } 
        });
      }, 1000);
    };

    const cleanupListener = editorInstance.store.listen(handleChange);

    return () => {
      cleanupListener();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [activeBoard, dispatch]);

  const updateBoardProject = (newProjectId: string) => {
    if (!activeBoard) return;
    dispatch({ type: 'UPDATE_WHITEBOARD', payload: { id: activeBoard.id, projectId: newProjectId } });
    setIsProjectPickerOpen(false);
    setProjectSearch('');
  };

  const createBoard = () => {
    const newId = crypto.randomUUID();
    const today = new Date().toLocaleDateString();
    
    dispatch({ type: 'ADD_WHITEBOARD', payload: { 
        id: newId, 
        name: 'New Board',
        createdAt: today,      
        lastUpdated: today     
    }});
    setSelectedBoardId(newId);
    setSearch('');
  };

  return (
    <div className="flex h-full gap-4">
      {/* Sidebar */}
      <div className="w-48 glass rounded-2xl p-4 flex flex-col z-10">
        <h3 className="font-bold mb-4 text-slate-300">Boards</h3>
        
        {/* Search Bar */}
        <div className="mb-4 relative">
             <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
             <input 
                type="text" 
                placeholder="Search..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 placeholder-slate-600 transition-colors"
             />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-2 flex flex-col">
            <div className="flex-1">
                {paginatedBoards.length > 0 ? paginatedBoards.map((wb:any) => (
                    <div 
                        key={wb.id} 
                        onClick={() => setSelectedBoardId(wb.id)} 
                        className={`p-2 rounded cursor-pointer text-sm truncate group relative flex justify-between items-center ${selectedBoardId === wb.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                    >
                        <span className="truncate pr-2">{wb.name}</span>
                        <button onClick={e => { e.stopPropagation(); if (confirm('Delete?')) dispatch({ type: 'DELETE_WHITEBOARD', payload: wb.id }); }} className={`hover:text-red-400 ${selectedBoardId === wb.id ? 'text-white' : 'opacity-0 group-hover:opacity-100'}`}>
                            <Trash2 size={14} />
                        </button>
                    </div>
                )) : (
                    <p className="text-slate-500 text-xs text-center italic mt-2">No boards found.</p>
                )}
            </div>

            {/* Pagination Controls */}
            {filteredBoards.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between px-1 py-3 border-t border-slate-800/50 mt-2">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="text-slate-500 hover:text-white disabled:opacity-30">
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs text-slate-500 font-mono">{currentPage}/{totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="text-slate-500 hover:text-white disabled:opacity-30">
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>

        <button onClick={createBoard} className="bg-slate-800 w-full rounded py-2 text-xs font-bold text-slate-300 hover:text-white mt-2 flex items-center justify-center gap-2">
            <Plus size={14} /> New Board
        </button>
      </div>

      {/* Tldraw Canvas */}
      <div className="flex-1 glass-heavy rounded-2xl overflow-hidden relative">
         <div className="absolute inset-0 tldraw-wrapper">
            {activeBoard ? (
                <Tldraw 
                    key={activeBoard.id} 
                    onMount={handleMount} 
                    // assetUrls={assetUrls}  <-- REMOVED THIS LINE
                    inferDarkMode 
                />
            ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                    Select or Create a Board
                </div>
            )}
         </div>
         
         {activeBoard && (
             <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto flex flex-col items-center gap-2">
                 {/* Title Input */}
                 <input 
                    className="bg-slate-900/80 backdrop-blur border border-slate-700 rounded-full px-4 py-1 text-center text-sm font-bold text-slate-300 focus:text-white focus:outline-none focus:border-blue-500 transition-colors w-64 shadow-xl" 
                    value={activeBoard.name} 
                    onChange={e => dispatch({ type: 'UPDATE_WHITEBOARD', payload: { id: activeBoard.id, name: e.target.value } })} 
                 />

                 {/* Controls Row */}
                 <div className="flex items-center gap-2">
                     
                     {/* SEARCHABLE PROJECT PICKER */}
                     <div className="relative" ref={projectPickerRef}>
                         <button 
                             onClick={() => setIsProjectPickerOpen(!isProjectPickerOpen)}
                             className="flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-full px-3 py-1 shadow-lg hover:bg-slate-800 transition-colors min-w-[140px] justify-between"
                         >
                             <div className="flex items-center gap-2 truncate max-w-[110px]">
                                 <Link size={12} className="text-slate-500 shrink-0" />
                                 <span className="text-xs text-slate-400 truncate">{activeProject?.name || "Unlinked"}</span>
                             </div>
                             <ChevronDown size={12} className="text-slate-500" />
                         </button>

                         {isProjectPickerOpen && (
                             <div className="absolute top-full left-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col animate-[fadeIn_0.1s_ease-out]">
                                 <div className="p-2 border-b border-slate-800">
                                     <div className="relative">
                                         <Search className="absolute left-2 top-2 text-slate-500" size={12} />
                                         <input 
                                             autoFocus
                                             type="text" 
                                             placeholder="Find project..." 
                                             value={projectSearch}
                                             onChange={(e) => setProjectSearch(e.target.value)}
                                             className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                                         />
                                     </div>
                                 </div>
                                 <div className="max-h-60 overflow-y-auto p-1 space-y-0.5">
                                     <button onClick={() => updateBoardProject('')} className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-800 rounded-lg hover:text-white transition-colors">
                                         -- Unlinked --
                                     </button>
                                     {pickerFilteredProjects.length > 0 ? pickerFilteredProjects.map((p:any) => (
                                         <button 
                                             key={p.id} 
                                             onClick={() => updateBoardProject(p.id)}
                                             className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex justify-between items-center ${activeBoard.projectId === p.id ? 'bg-blue-600/20 text-blue-400' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                                         >
                                             <span className="truncate">{p.name}</span>
                                             {p.status === 'Done' && <span className="text-[10px] bg-slate-800 px-1 rounded text-slate-500 ml-2">Done</span>}
                                         </button>
                                     )) : (
                                         <div className="px-3 py-2 text-xs text-slate-500 italic text-center">No projects found.</div>
                                     )}
                                 </div>
                             </div>
                         )}
                     </div>

                     {/* DATE BADGES */}
                     <div className="flex items-center gap-3 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-full px-3 py-1 shadow-lg">
                        <div className="flex items-center gap-1" title="Created Date">
                            <Calendar size={12} className="text-slate-500" />
                            <span className="text-[10px] text-slate-400">{activeBoard.createdAt || 'Unknown'}</span>
                        </div>
                        <div className="w-px h-3 bg-slate-700"></div>
                        <div className="flex items-center gap-1" title="Last Edited">
                            <Clock size={12} className="text-slate-500" />
                            <span className="text-[10px] text-slate-400">{activeBoard.lastUpdated || 'Just now'}</span>
                        </div>
                     </div>
                 </div>
             </div>
         )}
      </div>
    </div>
  );
};