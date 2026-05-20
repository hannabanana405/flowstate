import { create } from 'zustand';
import { db } from '../config/firebase';
import { collection, onSnapshot, query, where, doc, setDoc, deleteDoc } from 'firebase/firestore';

// 1. Strict Types for all your data
export interface Task { id: string; title: string; status: string; project?: string; archived?: boolean; dueDate?: string; recurrence?: string; [key: string]: any; }
export interface Project { id: string; name: string; status: string; [key: string]: any; }
export interface Doc { id: string; title: string; [key: string]: any; }
export interface Whiteboard { id: string; name: string; [key: string]: any; }

interface DataState {
  user: any | null;
  tasks: Task[];
  projects: Project[];
  docs: Doc[];
  whiteboards: Whiteboard[];
  loading: boolean;
  error: string | null; 
  lastSynced: string | null;
  
  // Actions
  setUser: (user: any) => void;
  subscribeToData: (uid: string) => () => void;
  saveItem: (collectionName: 'tasks' | 'projects' | 'docs' | 'whiteboards', item: any) => Promise<void>;
  deleteItem: (collectionName: 'tasks' | 'projects' | 'docs' | 'whiteboards', itemId: string) => Promise<void>;
}

const getToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const useDataStore = create<DataState>((set, get) => ({
  user: null,
  tasks: [],
  projects: [],
  docs: [],
  whiteboards: [],
  loading: true,
  error: null,
  lastSynced: null,

  setUser: (user) => set({ user }),

  // 2. The Universal Save Function
  saveItem: async (collectionName, item) => {
      const uid = get().user?.uid;
      if (!uid) return;
      
      const finalItem = {
          ...item,
          id: item.id || crypto.randomUUID(),
          lastUpdated: getToday(), // Auto-stamp everything!
      };

      // Optimistically update the UI instantly so it feels blazing fast
      set((state) => {
          const list = state[collectionName] as any[];
          const exists = list.find(i => i.id === finalItem.id);
          return {
              [collectionName]: exists 
                  ? list.map(i => i.id === finalItem.id ? { ...i, ...finalItem } : i)
                  : [...list, finalItem]
          };
      });

      // Send to Firebase in the background
      try {
          await setDoc(doc(db, "users", uid, collectionName, finalItem.id), finalItem, { merge: true });
      } catch (e) {
          console.error(`Failed to save to ${collectionName}:`, e);
      }
  },

  // 3. The Universal Delete Function
  deleteItem: async (collectionName, itemId) => {
      const uid = get().user?.uid;
      if (!uid) return;

      // Optimistic UI update
      set((state) => ({
          [collectionName]: (state[collectionName] as any[]).filter(i => i.id !== itemId)
      }));

      try {
          await deleteDoc(doc(db, "users", uid, collectionName, itemId));
      } catch (e) {
          console.error(`Failed to delete from ${collectionName}:`, e);
      }
  },
  
  // 4. The Grand Central Listener
  subscribeToData: (uid) => {
    const unsubs: (() => void)[] = [];

    // Tasks (Only unarchived)
    unsubs.push(onSnapshot(
        query(collection(db, 'users', uid, 'tasks'), where('archived', '==', false)), 
        (snap) => {
            const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
            set({ tasks, lastSynced: new Date().toLocaleTimeString(), loading: false });
        }
    ));

    // Listen to Projects, Docs, and Whiteboards dynamically
    ['projects', 'docs', 'whiteboards'].forEach((col) => {
        unsubs.push(onSnapshot(
            collection(db, 'users', uid, col), 
            (snap) => {
                const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                set({ [col]: data });
            }
        ));
    });

    return () => unsubs.forEach(unsub => unsub());
  }
}));