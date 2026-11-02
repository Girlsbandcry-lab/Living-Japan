import { SEARCH_GLYPHS } from './search-glyphs.js';

// LJ-SEARCH-GLYPHS: search keys never replace displayed names, activation names or IDs.
export function normalizeSearchText(value) {
  const normalized = String(value ?? '').normalize('NFKC').toLowerCase();
  return Array.from(normalized, char => SEARCH_GLYPHS[char] || char).join('').replace(/\s+/gu, ' ').trim();
}

export function tokenizeSearchQuery(query) {
  return [...new Set(normalizeSearchText(query).split(' ').filter(Boolean))];
}

export const prepareSearchFields = fields => [...new Set((Array.isArray(fields) ? fields : [fields])
  .filter(value => typeof value === 'string').map(normalizeSearchText).filter(Boolean))];

export function matchesSearchFields(fields, query, contextFields = []) {
  const tokens = tokenizeSearchQuery(query);
  return tokens.length > 0 && matchesPreparedSearchFields(prepareSearchFields(fields), tokens, prepareSearchFields(contextFields));
}

export function matchesPreparedSearchFields(own, tokens, context = []) {
  if (!tokens.length) return false;
  const touchesOwn = token => own.some(name => name.includes(token)) || context.some(parent => own.some(name => {
    // A joined match must cross this actual parent/name boundary.
    const position = (parent + name).indexOf(token, Math.max(0, parent.length - token.length + 1));
    return position >= 0 && position < parent.length;
  }));
  let hasOwnMatch = false;
  for (const token of tokens) {
    if (touchesOwn(token)) hasOwnMatch = true;
    else if (!context.some(parent => parent.includes(token))) return false;
  }
  return hasOwnMatch;
}
