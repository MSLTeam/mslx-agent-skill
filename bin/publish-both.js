#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const source = path.resolve(__dirname, '..');
const manifest = require('../package.json');
const names = [manifest.name, 'mslx-agent-skill'];
const registry = '--registry=https://registry.npmjs.org/';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function runNpm(args, cwd) {
  const result = spawnSync(npm, args, {
    cwd,
    stdio: 'inherit',
    // npm is a command script on Windows. All arguments used here are fixed.
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`npm ${args[0]} 失败 (${result.status ?? result.signal})`);
}

function main() {
  const [mode, destination, ...extra] = process.argv.slice(2);
  if (mode && (mode !== '--pack' || !destination || extra.length)) {
    throw new Error('用法: npm run publish-both [-- --pack <输出目录>]');
  }

  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'mslx-agent-publish-'));
  try {
    const output = destination ? path.resolve(destination) : staging;
    fs.mkdirSync(output, { recursive: true });
    for (const [index, name] of names.entries()) {
      const packageDir = path.join(staging, String(index));
      fs.mkdirSync(packageDir);
      for (const file of manifest.files) {
        const target = path.join(packageDir, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(source, file), target);
      }
      fs.writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({ ...manifest, name }, null, 2) + '\n');
      console.log(`${destination ? '打包' : '发布'} ${name}@${manifest.version}`);
      if (destination) {
        // npm reads the package from the current directory and writes the archive there.
        runNpm(['pack', '--ignore-scripts'], packageDir);
        const archive = fs.readdirSync(packageDir).find(file => file.endsWith('.tgz'));
        fs.copyFileSync(path.join(packageDir, archive), path.join(output, archive));
      } else {
        runNpm(['publish', '--access=public', registry], packageDir);
      }
    }
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
