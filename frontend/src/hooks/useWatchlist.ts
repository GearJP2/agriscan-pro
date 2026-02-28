import { useState, useEffect } from 'react';

const WATCHLIST_KEY = 'sample-watchlist';

export const useWatchlist = () => {
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

  return {
    watchlist,
    addToWatchlist,
    removeFromWatchlist,
    toggleWatchlist,
    isWatching,
    watchlistCount: watchlist.length,
  };
};
