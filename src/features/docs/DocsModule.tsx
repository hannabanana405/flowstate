import { useState, useEffect, useRef } from 'react';
import { 
  FileText, Plus, Trash2, CheckCircle, Loader2, Folder, Search, 
  ChevronDown, ChevronRight, ChevronLeft, Bold, Italic, List
} from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

export const DocsModule = ({ data, projects, dispatch, focusDocId, clearFocus }: any) => {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [content, setContent] = useState(''); 
  const [status, setStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false); 
  const [projectFilter, setProjectFilter] = useState('All'); // <-- NEW FILTER STATE
  
  // --- PROJECT PICKER STATE (FOR ACTIVE DOC) ---
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const projectPickerRef = useRef<HTMLDivElement>(null);

  // --- FILTER PICKER STATE (FOR SIDEBAR) ---
  const [isFilterPickerOpen, setIsFilterPickerOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const filterPickerRef = useRef<HTMLDivElement>(null);

  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const saveTimeoutRef = useRef<any>(null);

  // 0. HANDLE FOCUS FROM PROJECTS/DASHBOARD
  useEffect(() => {
    if (focusDocId) {
        setSelectedDocId(focusDocId);
        if (clearFocus) clearFocus();
    }
  }, [focusDocId, clearFocus]);

  // 1. Load Document Logic (Fallback if no focus)
  useEffect(() => {
    if (!selectedDocId && !focusDocId && data.docs && data.docs.length > 0) {
      const firstActive = data.docs.find((d:any) => {
          const p = projects?.find((proj:any) => proj.id === d.projectId);
          return !p || p.status !== 'Done';
      });
      setSelectedDocId(firstActive ? firstActive.id : data.docs[0].id);
    }
  }, [data.docs, selectedDocId, projects, focusDocId]);

  // 2. Auto-Save Engine (Rewritten for TipTap)
  const handleContentChange = (newContent: string) => {
    setContent(newContent); 
    setStatus('saving');

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      if (!selectedDocId) return;
      dispatch({ type: 'UPDATE_DOC', payload: { id: selectedDocId, content: newContent } });
      setStatus('saved');
    }, 1000);
  };

  // Initialize TipTap Editor
  const editor = useEditor({
    extensions: [StarterKit],
    content: content,
    editorProps: {
        attributes: {
            class: 'focus:outline-none min-h-full pb-32 text-sm leading-relaxed text-slate-300 tiptap-editor'
        }
    },
    onUpdate: ({ editor }) => {
      handleContentChange(editor.getHTML());
    },
  });

  // When switching docs, load content into TipTap
  useEffect(() => {
    const activeDoc = data.docs.find((d: any) => d.id === selectedDocId);
    if (activeDoc) {
      const newContent = activeDoc.content || '';
      setContent(newContent); 
      if (editor && editor.getHTML() !== newContent) {
          editor.commands.setContent(newContent);
      }
      setStatus('saved');
    }
  }, [selectedDocId, data.docs, editor]); 

  // Reset pagination when search or filter changes
  useEffect(() => {
      setCurrentPage(1);
  }, [search, projectFilter]);

  // Close pickers when clicking outside
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (projectPickerRef.current && !projectPickerRef.current.contains(event.target as Node)) {
              setIsProjectPickerOpen(false);
          }
          if (filterPickerRef.current && !filterPickerRef.current.contains(event.target as Node)) {
              setIsFilterPickerOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateDocProject = (newProjectId: string) => {
    if (!selectedDocId) return;
    setStatus('saving');
    dispatch({ type: 'UPDATE_DOC', payload: { id: selectedDocId, projectId: newProjectId } });
    setIsProjectPickerOpen(false); 
    setProjectSearch(''); 
    setTimeout(() => setStatus('saved'), 500);
  };

  const createDoc = () => {
    const newId = crypto.randomUUID();
    dispatch({ 
        type: 'ADD_DOC', 
        payload: { 
            id: newId, 
            title: 'Untitled Doc', 
            content: '', 
            projectId: '',
            createdAt: new Date().toISOString()
        } 
    });
    setSelectedDocId(newId);
    setContent('');
    setSearch('');
  };

  const deleteDoc = (id: string, e: any) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this document?')) {
        dispatch({ type: 'DELETE_DOC', payload: id });
        if (selectedDocId === id) setSelectedDocId(null);
    }
  };

  // 3. SMART SORTING & PAGINATION LOGIC
  const isDocArchived = (doc: any) => {
      if (!doc.projectId) return false; 
      const parentProject = projects?.find((p:any) => p.id === doc.projectId);
      return parentProject && parentProject.status === 'Done';
  };

  const allFilteredDocs = [...data.docs] // Create a copy so we don't mutate state
      .reverse() // Puts newly added items at the top by default
      .filter((doc: any) => {
          // 1. Filter by Project First
          if (projectFilter !== 'All' && doc.projectId !== projectFilter) return false;
          
          // 2. Then Filter by Search
          const query = search.toLowerCase();
          const matchTitle = doc.title && doc.title.toLowerCase().includes(query);
          const matchContent = doc.content && doc.content.toLowerCase().includes(query);
          return matchTitle || matchContent;
      })
      .sort((a: any, b: any) => {
          // 3. Keep recently edited docs at the very top
          const dateA = new Date(a.createdAt || a.lastUpdated || 0).getTime();
          const dateB = new Date(b.createdAt || b.lastUpdated || 0).getTime();
          return dateB - dateA;
      });

  const activeDocsList = allFilteredDocs.filter((d:any) => !isDocArchived(d));
  const archivedDocsList = allFilteredDocs.filter((d:any) => isDocArchived(d));

  const totalPages = Math.ceil(activeDocsList.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedActiveDocs = activeDocsList.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const activeDoc = data.docs.find((d: any) => d.id === selectedDocId);
  const activeProject = projects?.find((p:any) => p.id === activeDoc?.projectId);

  // Filter projects for the picker
  const pickerFilteredProjects = projects?.filter((p:any) => 
      p.name.toLowerCase().includes(projectSearch.toLowerCase())
  ) || [];

  // Helper to render a doc item
  const renderDocItem = (doc: any) => (
    <div 
        key={doc.id} 
        onClick={() => setSelectedDocId(doc.id)} 
        className={`p-3 rounded-xl cursor-pointer text-sm group relative flex justify-between items-center transition-all ${selectedDocId === doc.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800'}`}
    >
        <div className="flex items-center gap-3 truncate min-w-0">
            {/* Added shrink-0 so flexbox stops squishing the icon */}
            <FileText size={16} className={`shrink-0 ${selectedDocId === doc.id ? 'text-blue-200' : 'text-slate-500'}`} />
            <span className="truncate">{doc.title || "Untitled Doc"}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
            {doc.createdAt && (
                 <span className={`text-[10px] ${selectedDocId === doc.id ? 'text-blue-300' : 'text-slate-600 group-hover:text-slate-500'}`}>
                     {new Date(doc.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                 </span>
            )}
            <button onClick={(e) => deleteDoc(doc.id, e)} className={`hover:text-red-200 ${selectedDocId === doc.id ? 'text-blue-200' : 'opacity-0 group-hover:opacity-100'}`}>
                <Trash2 size={14} />
            </button>
        </div>
    </div>
  );

  return (
    <div className="flex h-full gap-4">
      {/* Sidebar List */}
      <div className="w-64 glass rounded-2xl p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-300">Documents</h3>
            <button onClick={createDoc} className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600 hover:text-white transition-colors">
                <Plus size={16} />
            </button>
        </div>

        <div className="mb-4 space-y-2">
            <div className="relative">
                 <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
                 <input 
                    type="text" 
                    placeholder="Search docs..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 placeholder-slate-600 transition-colors"
                 />
            </div>
            
            {/* --- CUSTOM SEARCHABLE PROJECT FILTER --- */}
            <div className="relative" ref={filterPickerRef}>
                <button 
                    onClick={() => setIsFilterPickerOpen(!isFilterPickerOpen)}
                    className="w-full flex items-center justify-between bg-slate-900 border border-slate-700 text-slate-300 py-2 px-3 rounded-lg hover:bg-slate-800 transition-colors focus:outline-none focus:border-blue-500"
                >
                    <span className="text-xs truncate mr-2">
                        {projectFilter === 'All' ? 'All Projects' : projects?.find((p:any) => p.id === projectFilter)?.name || 'All Projects'}
                    </span>
                    <ChevronDown size={14} className="text-slate-500 shrink-0" />
                </button>

                {isFilterPickerOpen && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col animate-[fadeIn_0.1s_ease-out]">
                        <div className="p-2 border-b border-slate-800">
                            <div className="relative">
                                <Search className="absolute left-2 top-2 text-slate-500" size={12} />
                                <input 
                                    autoFocus
                                    type="text" 
                                    placeholder="Find project..." 
                                    value={filterSearch}
                                    onChange={(e) => setFilterSearch(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
                            <button 
                                onClick={() => { setProjectFilter('All'); setIsFilterPickerOpen(false); }} 
                                className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors ${projectFilter === 'All' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                            >
                                All Projects
                            </button>
                            {projects
                                ?.filter((p:any) => p.status !== 'Done')
                                .filter((p:any) => p.name.toLowerCase().includes(filterSearch.toLowerCase()))
                                .map((p:any) => (
                                <button 
                                    key={p.id} 
                                    onClick={() => { setProjectFilter(p.id); setIsFilterPickerOpen(false); }}
                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors truncate ${projectFilter === p.id ? 'bg-blue-600/20 text-blue-400' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                                >
                                    {p.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 flex flex-col">
            <div className="flex-1">
                {paginatedActiveDocs.length > 0 ? paginatedActiveDocs.map(renderDocItem) : (
                    <p className="text-slate-500 text-xs text-center italic mt-2">No active docs.</p>
                )}
            </div>

            {activeDocsList.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between px-2 py-3 border-t border-slate-800/50 mt-2">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="text-slate-500 hover:text-white disabled:opacity-30">
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs text-slate-500 font-mono">{currentPage}/{totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="text-slate-500 hover:text-white disabled:opacity-30">
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}

            {archivedDocsList.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-700/50">
                    <button onClick={() => setShowArchived(!showArchived)} className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase hover:text-slate-300 transition-colors w-full mb-2">
                        {showArchived ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                        <span>Archived ({archivedDocsList.length})</span>
                    </button>
                    {showArchived && (
                        <div className="space-y-1 animate-[fadeIn_0.2s_ease-out] max-h-40 overflow-y-auto pr-1">
                             {archivedDocsList.map(renderDocItem)}
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 glass-heavy rounded-2xl flex flex-col overflow-hidden relative">
         {activeDoc ? (
             <>
                <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/50 gap-4">
                    <input 
                        className="bg-transparent text-xl font-bold text-slate-200 focus:outline-none flex-1" 
                        value={activeDoc.title}
                        onChange={(e) => dispatch({ type: 'UPDATE_DOC', payload: { id: activeDoc.id, title: e.target.value } })}
                        placeholder="Untitled Document"
                    />

                    <div className="flex items-center gap-3">
                        {/* SEARCHABLE PROJECT PICKER */}
                        <div className="relative" ref={projectPickerRef}>
                            <button 
                                onClick={() => setIsProjectPickerOpen(!isProjectPickerOpen)}
                                className="flex items-center gap-2 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg py-1.5 px-3 hover:bg-slate-750 transition-colors min-w-[150px] justify-between"
                            >
                                <div className="flex items-center gap-2 truncate max-w-[120px]">
                                    <Folder size={14} className="text-slate-500 shrink-0"/>
                                    <span className="truncate">{activeProject?.name || "No Project Linked"}</span>
                                </div>
                                <ChevronDown size={12} className="text-slate-500" />
                            </button>

                            {isProjectPickerOpen && (
                                <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col animate-[fadeIn_0.1s_ease-out]">
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
                                        <button onClick={() => updateDocProject('')} className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-800 rounded-lg hover:text-white transition-colors">
                                            -- No Project --
                                        </button>
                                        {pickerFilteredProjects.length > 0 ? pickerFilteredProjects.map((p:any) => (
                                            <button 
                                                key={p.id} 
                                                onClick={() => updateDocProject(p.id)}
                                                className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex justify-between items-center ${activeDoc.projectId === p.id ? 'bg-blue-600/20 text-blue-400' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
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

                        {/* Status Indicator */}
                        <div className="flex items-center gap-2 text-xs font-mono px-3 py-1 rounded-full bg-slate-800 border border-slate-700 min-w-[100px] justify-center">
                            {status === 'saving' && (
                                <>
                                    <Loader2 size={12} className="animate-spin text-amber-400" />
                                    <span className="text-amber-400">Saving...</span>
                                </>
                            )}
                            {status === 'saved' && (
                                <>
                                    <CheckCircle size={12} className="text-emerald-400" />
                                    <span className="text-emerald-400">Saved</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-900/30 relative flex flex-col">
                    {/* Style block to prevent Tailwind from erasing bullet points inside the editor */}
                    <style>{`
                        .tiptap-editor ul { list-style-type: disc; padding-left: 1.5rem; margin-top: 0.5rem; margin-bottom: 0.5rem; }
                        .tiptap-editor p { margin-bottom: 0.5rem; }
                        .tiptap-editor strong { color: #f8fafc; font-weight: 700; }
                    `}</style>
                    
                    {/* Rich Text Toolbar */}
                    {editor && (
                        <div className="flex items-center gap-2 p-3 bg-slate-900/80 border-b border-slate-800 shrink-0 sticky top-0 z-10 backdrop-blur-sm">
                            <button 
                                onClick={() => editor.chain().focus().toggleBold().run()} 
                                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('bold') ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                                title="Bold (Cmd+B)"
                            >
                                <Bold size={16} />
                            </button>
                            <button 
                                onClick={() => editor.chain().focus().toggleItalic().run()} 
                                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('italic') ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                                title="Italic (Cmd+I)"
                            >
                                <Italic size={16} />
                            </button>
                            <div className="w-px h-4 bg-slate-700 mx-1"></div>
                            <button 
                                onClick={() => editor.chain().focus().toggleBulletList().run()} 
                                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('bulletList') ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                                title="Bullet List"
                            >
                                <List size={16} />
                            </button>
                        </div>
                    )}
                    
                    {/* The Actual Editor Canvas */}
                    <div className="flex-1 p-8 cursor-text" onClick={() => editor?.commands.focus()}>
                        <EditorContent editor={editor} className="h-full" />
                    </div>
                </div>
             </>
         ) : (
             <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
                 <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
                    <FileText size={32} className="text-slate-600" />
                 </div>
                 <p>Select a document or create a new one</p>
             </div>
         )}
      </div>
    </div>
  );
};