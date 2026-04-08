import { useState, useEffect } from 'react';

/**
 * A hook that returns true after a specified delay once the component has mounted.
 * Useful for deferring heavy components to prioritize initial navigation animations.
 * 
 * @param delay The delay in milliseconds (default 300ms)
 * @returns boolean indicating if the delay has passed
 */
export const useDeferredMount = (delay: number = 300) => {
  const [isDeferredMounted, setIsDeferredMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsDeferredMounted(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return isDeferredMounted;
};
