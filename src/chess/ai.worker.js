// Web Worker wrapper so the search never blocks rendering.
import { findBestMove } from './ai.js';

self.onmessage = (e) => {
  const { id, fen, historyKeys, level } = e.data;
  let result = null;
  try {
    result = findBestMove(fen, historyKeys, level);
  } catch (err) {
    console.error(err);
  }
  self.postMessage({ id, result });
};
