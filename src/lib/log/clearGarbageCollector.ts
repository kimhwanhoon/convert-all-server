export const clearGarbageCollector = () => {
  if (global.gc) {
    global.gc();
  }
};
