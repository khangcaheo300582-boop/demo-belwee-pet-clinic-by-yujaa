const fs = require('fs');
const path = require('path');

const cssPath = path.join(process.cwd(), 'app', 'globals.css');
const newPath = path.join(process.cwd(), 'scripts', '_new-footer.css');

const css = fs.readFileSync(cssPath, 'utf8');
const next = fs.readFileSync(newPath, 'utf8').replace(/\s+$/, '');

const startMarker = '/* ============================================================================\n   SITE FOOTER';
const endMarker = '/* ============================================================================\n   6. UTILITY CLASSES';

const start = css.indexOf(startMarker);
const end = css.indexOf(endMarker);

if (start === -1 || end === -1 || end <= start) {
  console.error('MARKER_NOT_FOUND start=' + start + ' end=' + end);
  process.exit(1);
}

// Keep the `}` that closes the media query immediately preceding the footer block.
if (css.slice(start - 2, start) !== '}\n' && css[start - 1] !== '}') {
  console.error('UNEXPECTED_PREV_CHAR: ' + JSON.stringify(css.slice(start - 6, start)));
  process.exit(1);
}

const out = css.slice(0, start) + next + '\n\n' + css.slice(end);

fs.writeFileSync(cssPath, out, 'utf8');
console.log('OK replaced ' + (end - start) + ' chars with ' + next.length);
console.log('lines now ' + out.split('\n').length);
