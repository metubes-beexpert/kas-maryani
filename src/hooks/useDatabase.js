import { useState, useEffect } from 'react';
import { ref, onValue, set, update, push, remove } from 'firebase/database';
import { db } from '../config/firebase';

export function useDatabase(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!path) return;
    
    setLoading(true);
    const dbRef = ref(db, path);
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        setData(snapshot.val());
      } else {
        setData(null);
      }
      setLoading(false);
    }, (err) => {
      setError(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [path]);

  const writeData = async (newData) => {
    try {
      await set(ref(db, path), newData);
    } catch (err) {
      throw err;
    }
  };

  const updateData = async (updates) => {
    try {
      await update(ref(db, path), updates);
    } catch (err) {
      throw err;
    }
  };

  const pushData = async (newData) => {
    try {
      const newRef = push(ref(db, path));
      await set(newRef, newData);
      return newRef.key;
    } catch (err) {
      throw err;
    }
  };

  const removeData = async () => {
    try {
      await remove(ref(db, path));
    } catch (err) {
      throw err;
    }
  };

  return { data, loading, error, writeData, updateData, pushData, removeData };
}
