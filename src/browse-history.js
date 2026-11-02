// LJ-BROWSE-SEARCH-01: search origin and return results never replace ordinary browsing state.
const copy = value => value == null ? null : structuredClone(value);
export function createBrowseHistory(saved = {}) {
  let origin = copy(saved.origin), results = copy(saved.results);
  return {
    begin(snapshot) { if (!origin || results) origin = copy(snapshot); results = null; },
    follow(snapshot) { results = copy(snapshot); },
    clear() { const value = copy(origin); origin = results = null; return value; },
    back() { const value = copy(results); results = null; return value; },
    hasReturn: () => Boolean(results),
    read: () => ({ origin: copy(origin), results: copy(results) }),
  };
}
