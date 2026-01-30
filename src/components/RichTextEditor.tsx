import { useRef, useEffect } from 'react';
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered } from 'lucide-react';

interface EditorProps {
  value: string;
  onChange: (html: string) => void;
}

export const RichTextEditor = ({ value, onChange }: EditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);

  // Sync external value changes to innerHTML
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const execCmd = (cmd: string) => {
    document.execCommand(cmd, false, undefined);
    editorRef.current?.focus();
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden">
      <div className="editor-toolbar flex gap-2 p-2 border-b border-white/10 bg-slate-900/60">
        <button onClick={() => execCmd('bold')} className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white" title="Bold"><Bold size={16} /></button>
        <button onClick={() => execCmd('italic')} className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white" title="Italic"><Italic size={16} /></button>
        <button onClick={() => execCmd('underline')} className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white" title="Underline"><Underline size={16} /></button>
        <button onClick={() => execCmd('strikeThrough')} className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white" title="Strikethrough"><Strikethrough size={16} /></button>
        <div className="w-px h-6 bg-slate-700 mx-2" />
        <button onClick={() => execCmd('insertUnorderedList')} className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white" title="Bullet List"><List size={16} /></button>
        <button onClick={() => execCmd('insertOrderedList')} className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white" title="Numbered List"><ListOrdered size={16} /></button>
      </div>
      <div 
        ref={editorRef} 
        className="editor-content flex-1 overflow-y-auto p-4 outline-none text-slate-200" 
        contentEditable 
        onInput={handleInput} 
        onBlur={handleInput} 
      />
    </div>
  );
};