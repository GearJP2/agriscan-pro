import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const WATCHLIST_KEY = 'sample-watchlist';

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
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    const stored = localStorage.getItem(WATCHLIST_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  const addToWatchlist = (sampleId: string) => {
    setWatchlist(prev => [...prev, sampleId]);
  };

  const removeFromWatchlist = (sampleId: string) => {
    setWatchlist(prev => prev.filter(id => id !== sampleId));
  };

  const toggleWatchlist = (sampleId: string) => {
    if (watchlist.includes(sampleId)) {
      removeFromWatchlist(sampleId);
    } else {
      addToWatchlist(sampleId);
    }
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
