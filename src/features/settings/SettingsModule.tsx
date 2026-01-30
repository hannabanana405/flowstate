import { useRef, useState } from 'react';
import { Download, Upload, ShieldCheck, AlertTriangle, FileJson } from 'lucide-react';

export const SettingsModule = ({ data, dispatch }: any) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  // 1. BACKUP: Download State as JSON
  const handleBackup = () => {
    const backupData = {
        tasks: data.tasks,
        projects: data.projects,
        docs: data.docs,
        whiteboards: data.whiteboards,
        timestamp: new Date().toISOString(),
        version: "1.0"
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowstate_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 2. RESTORE: Read JSON and Dispatch Import
  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("⚠️ CAUTION: This will overwrite items with matching IDs and add missing ones. \n\nAre you sure you want to merge this backup?")) {
        e.target.value = ''; // Reset input
        return;
    }

    setImporting(true);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        // Basic Validation
        if (!json.tasks || !json.projects) throw new Error("Invalid Backup File");

        dispatch({ type: 'IMPORT_DATA', payload: json });
        alert(`✅ Restore Complete!\n\nImported:\n- ${json.tasks.length} Tasks\n- ${json.projects.length} Projects\n- ${json.docs.length} Docs\n- ${json.whiteboards.length} Boards`);
      } catch (err) {
        alert("❌ Failed to restore: Invalid file format.");
        console.error(err);
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    
    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4 mb-8">
        <h2 className="text-3xl font-bold text-white">Data & Security</h2>
        <ShieldCheck className="text-emerald-400" size={32} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* DOWNLOAD CARD */}
        <div className="glass p-8 rounded-2xl border-l-4 border-blue-500">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400">
                    <Download size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white">Backup Data</h3>
                    <p className="text-xs text-slate-400">Save a local copy of everything.</p>
                </div>
            </div>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
                Download a JSON file containing all your tasks, projects, docs, and whiteboards. 
                Keep this safe! It allows you to restore your work if you ever lose access.
            </p>
            <button onClick={handleBackup} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
                <FileJson size={18} /> Download Backup
            </button>
        </div>

        {/* UPLOAD CARD */}
        <div className="glass p-8 rounded-2xl border-l-4 border-amber-500">
             <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-amber-500/20 rounded-xl text-amber-400">
                    <Upload size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white">Restore Data</h3>
                    <p className="text-xs text-slate-400">Import from a previous backup.</p>
                </div>
            </div>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
                Upload a backup file to restore your data. 
                <span className="text-amber-400 font-bold block mt-2">
                    <AlertTriangle size={12} className="inline mr-1" />
                    Note: This merges data. It will update existing items and create missing ones.
                </span>
            </p>
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleRestore} 
                accept=".json" 
                className="hidden" 
            />
            <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={importing}
                className={`w-full font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all ${importing ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-600'}`}
            >
                {importing ? 'Restoring...' : <><Upload size={18} /> Select Backup File</>}
            </button>
        </div>
      </div>

      <div className="p-6 bg-slate-900/50 rounded-xl border border-slate-800 text-center text-slate-500 text-xs">
          Your data is encrypted by Google Firestore. This backup tool provides an extra layer of personal ownership.
      </div>
    </div>
  );
};