/**
 * Ensures @tensorflow/tfjs-node shim exists in node_modules.
 * face-api.node.js hardcodes require('@tensorflow/tfjs-node'),
 * but we only need the pure JS @tensorflow/tfjs backend.
 * This script creates a tiny shim that re-exports @tensorflow/tfjs.
 */
const fs = require('fs');
const path = require('path');

const shimDir = path.join(__dirname, '..', 'node_modules', '@tensorflow', 'tfjs-node');
const indexFile = path.join(shimDir, 'index.js');
const pkgFile = path.join(shimDir, 'package.json');

// Only create shim if the real tfjs-node isn't installed
try {
  require.resolve('@tensorflow/tfjs-node');
  // If resolve succeeds, check if it's our shim or a real install
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
  if (pkg.description && pkg.description.includes('Shim')) {
    // Our shim already exists, all good
    process.exit(0);
  }
  // Real tfjs-node installed, skip
  process.exit(0);
} catch {
  // Not installed — create the shim
}

fs.mkdirSync(shimDir, { recursive: true });
fs.writeFileSync(indexFile, "module.exports = require('@tensorflow/tfjs');\n");
fs.writeFileSync(pkgFile, JSON.stringify({
  name: '@tensorflow/tfjs-node',
  version: '4.22.0',
  main: 'index.js',
  description: 'Shim redirecting to @tensorflow/tfjs (pure JS)',
}, null, 2) + '\n');

console.log('[postinstall] Created @tensorflow/tfjs-node shim → @tensorflow/tfjs');
