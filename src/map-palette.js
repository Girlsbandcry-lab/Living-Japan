// LJ-MAP-PRESENTATION-01: the approved sea palette also drives canvas geometry and labels.
const palettes = {
  day: { sea: '#c7e5ed', land: '#f2f8f7', park: '#d6ebdd', river: '#9dcdd9', road: '#ffffff', rail: '#8399a0', subway: '#9c7d6b', lightRail: '#658070', tram: '#8d7c6b', branch: '#afc5cb', boundary: '#9bb4bd', minorBoundary: '#bdcfd4', text: '#3f5b66', parkText: '#52735d', halo: '#f2f8f7', station: '#527c80', point: '#7b766b', selected: '#b84535', selectedText: '#8d3327', selectedSurface: '#ffffff', route: '#9b5700', endpoint: '#00755f' },
  night: { sea: '#123b4b', land: '#0f202b', park: '#1d4642', river: '#246174', road: '#49606b', rail: '#809ca8', subway: '#cba28c', lightRail: '#91bda8', tram: '#b5a48a', branch: '#49616e', boundary: '#526f7c', minorBoundary: '#3e5c69', text: '#c5e1e9', parkText: '#a2c7ad', halo: '#0f202b', station: '#a7d8d9', point: '#c9bea8', selected: '#ff9c8f', selectedText: '#ffb9ad', selectedSurface: '#17313d', route: '#ffd081', endpoint: '#79dbc2' },
};
export const mapPalette = theme => palettes[theme === 'night' ? 'night' : 'day'];
export function schematicLineColor(color, theme) {
  if (theme !== 'night' || !/^#[0-9a-f]{6}$/i.test(color || '')) return color || mapPalette(theme).rail;
  return '#' + color.slice(1).match(/../g).map(value => Math.round(parseInt(value, 16) * 0.68 + 255 * 0.32).toString(16).padStart(2, '0')).join('');
}
