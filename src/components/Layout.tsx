import { LayoutDashboard, CheckSquare, Briefcase, FileText, PenTool, LogOut } from 'lucide-react';
import { useAuthStore } from '../features/auth/useAuthStore';
import { auth } from '../config/firebase';
import { signOut } from 'firebase/auth';

// Define the exact View type here to avoid errors
export type View = 'dashboard' | 'tasks' | 'projects' | 'docs' | 'whiteboard';

interface SidebarProps {
  activeView: View;
  onViewChange: (view: View) => void;
}

export const Sidebar = ({ activeView, onViewChange }: SidebarProps) => {
  const menu = [
    { id: 'dashboard', icon: LayoutDashboard, label: "Today's Focus" },
    { id: 'tasks', icon: CheckSquare, label: 'Task Manager' },
    { id: 'projects', icon: Briefcase, label: 'Projects' },
    { id: 'docs', icon: FileText, label: 'Docs' },
    { id: 'whiteboard', icon: PenTool, label: 'Whiteboard' },
  ];

  const handleLogout = () => {
    signOut(auth);
    useAuthStore.getState().setUser(null);
  };

  return (
    <div className="w-64 h-screen bg-slate-900 border-r border-slate-800 flex flex-col fixed left-0 top-0 z-20">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
          FlowState
        </h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {menu.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
                <button
                    key={item.id}
                    onClick={() => onViewChange(item.id as View)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                        isActive 
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                    }`}
                >
                    <Icon size={20} />
                    <span className="font-medium">{item.label}</span>
                </button>
            );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-red-400 transition-colors w-full px-4"
        >
            <LogOut size={16} />
            <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};