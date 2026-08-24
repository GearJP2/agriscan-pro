import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const WATCHLIST_KEY = 'sample-watchlist';

const readWatchlist = (key: string): string[] => {
  try {
    const stored = localStorage.getItem(key);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

interface WatchlistContextType {
  watchlist: string[];
  addToWatchlist: (sampleId: string) => void;
  removeFromWatchlist: (sampleId: string) => void;
  toggleWatchlist: (sampleId: string) => void;
  isWatching: (sampleId: string) => boolean;
  watchlistCount: number;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

export const WatchlistProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const storageKey = `${WATCHLIST_KEY}:${user?.id ?? 'guest'}`;
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    setWatchlist(readWatchlist(storageKey));
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(watchlist));
  }, [storageKey, watchlist]);

  const addToWatchlist = (sampleId: string) => {
    setWatchlist(prev => prev.includes(sampleId) ? prev : [...prev, sampleId]);
  };

  const removeFromWatchlist = (sampleId: string) => {
    setWatchlist(prev => prev.filter(id => id !== sampleId));
  };

  const toggleWatchlist = (sampleId: string) => {
    setWatchlist(prev => prev.includes(sampleId)
      ? prev.filter(id => id !== sampleId)
      : [...prev, sampleId]);
  };

  const isWatching = (sampleId: string) => watchlist.includes(sampleId);

  return (
    <WatchlistContext.Provider
      value={{
        watchlist,
        addToWatchlist,
        removeFromWatchlist,
        toggleWatchlist,
        isWatching,
        watchlistCount: watchlist.length,
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
};

export const useWatchlistContext = () => {
  const context = useContext(WatchlistContext);
  if (context === undefined) {
    throw new Error('useWatchlistContext must be used within a WatchlistProvider');
  }
  return context;
};
