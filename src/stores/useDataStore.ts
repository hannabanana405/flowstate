import { create } from 'zustand';
import { db } from '../config/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

// Define strict types
export interface Task { id: string; title: string; status: string; project?: string; archived?: boolean; }
export interface Project { id: string; name: string; status: string; }

interface DataState {
  tasks: Task[];
  projects: Project[];
  loading: boolean;
  lastSynced: string | null;
  
  // The "Subscriber" function
  subscribeToData: (uid: string) => () => void;
}

export const useDataStore = create<DataState>((set) => ({
  tasks: [],
  projects: [],
  loading: true,
  lastSynced: null,

  subscribeToData: (uid) => {
    // 1. Tasks Listener (Active only)
    const qTasks = query(collection(db, 'users', uid, 'tasks'), where('archived', '==', false));
    const unsubTasks = onSnapshot(qTasks, (snap) => {
      const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      set({ tasks, lastSynced: new Date().toLocaleTimeString() });
    });

    // 2. Projects Listener
    const unsubProjects = onSnapshot(collection(db, 'users', uid, 'projects'), (snap) => {
        const projects = snap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
        set({ projects });
    });

    set({ loading: false });

    // Return cleanup function to stop listening when logged out
    return () => { 
        unsubTasks(); 
        unsubProjects(); 
    };
  }
}));