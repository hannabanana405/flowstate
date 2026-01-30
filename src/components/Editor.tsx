import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
}

export const Editor = ({ value, onChange }: EditorProps) => {
  return (
    <div className="h-full flex flex-col">
      <ReactQuill 
        theme="snow" 
        value={value} 
        onChange={onChange}
        className="flex-1 flex flex-col overflow-hidden bg-slate-900/50 rounded-xl border border-slate-700 text-slate-200"
        modules={{
            toolbar: [
                [{ 'header': [1, 2, false] }],
                ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                [{'list': 'ordered'}, {'list': 'bullet'}],
                ['link', 'clean']
            ],
        }} 
      />
      {/* Custom CSS overrides to force the editor into Dark Mode */}
      <style>{`
        .ql-toolbar { border-color: rgba(255,255,255,0.1) !important; background: rgba(15,23,42,0.6); color: white; }
        .ql-container { border: none !important; font-size: 16px; }
        .ql-stroke { stroke: #94a3b8 !important; }
        .ql-fill { fill: #94a3b8 !important; }
        .ql-picker { color: #94a3b8 !important; }
        .ql-editor { color: #e2e8f0; height: 100%; overflow-y: auto; }
        .ql-editor.ql-blank::before { color: #64748b; font-style: italic; }
      `}</style>
    </div>
  );
};