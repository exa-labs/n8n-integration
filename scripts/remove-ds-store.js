#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set(['.git', 'node_modules']);

const targets = process.argv.length > 2 ? process.argv.slice(2) : ['.'];

function removeDsStore(targetPath) {
	if (!fs.existsSync(targetPath)) {
		return;
	}

	const stats = fs.statSync(targetPath);

	if (stats.isDirectory()) {
		const entries = fs.readdirSync(targetPath, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) {
				continue;
			}
			removeDsStore(path.join(targetPath, entry.name));
		}
	} else if (stats.isFile() && path.basename(targetPath) === '.DS_Store') {
		fs.rmSync(targetPath, { force: true });
	}
}

for (const target of targets) {
	removeDsStore(path.resolve(process.cwd(), target));
}
