'use strict';

const chalk = require('chalk');
const glob = require('glob');
const path = require('path');
const { execFileSync } = require('child_process');

const mode = process.argv[2] || 'check';
const shouldWrite = mode === 'write' || mode === 'write-changed';
const onlyChanged = mode === 'check-changed' || mode === 'write-changed';

const isWindows = process.platform === 'win32';
const prettier = isWindows ? 'prettier.cmd' : 'prettier';
const prettierCmd = path.resolve(__dirname, 'node_modules/.bin/' + prettier);

const defaultOptions = {
    'bracket-spacing': 'false',
    'single-quote': 'true',
    'jsx-bracket-same-line': 'true',
    'trailing-comma': 'all',
    'print-width': 80
};

const config = {
    default: {
        patterns: ['src/**/*.js']
    },
    tests: {
        patterns: ['tests/**/*.js'],
        options: {
            'tailing-comma': 'es5'
        }
    }
};

function exec(command, args) {
    console.log('> ' + [command].concat(args).join(' '));
    const options = {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'pipe',
        encoding: 'utf-8'
    };

    return execFileSync(command, args, options);
}

Object.keys(config).forEach(key => {
    const { patterns, options } = config[key];
    const globPatterns = patterns.length > 1
        ? `{${patterns.join(',')}}`
        : `${patterns.join(',')}`;
    const files = glob
        .sync(globPatterns)
        .filter(f => !onlyChanged);

    if (!files.length) {
        return;
    }

    const args = Object.keys(defaultOptions).map(
        k => `--${k}=${(options && options[k]) || defaultOptions[k]}`
    );
    args.push(`--${shouldWrite ? 'write' : 'l'}`);

    try {
        exec(prettierCmd, [ ...args, ...files ]);
    } catch (e) {
        if (!shouldWrite) {
            process.exit(1);
        }
        throw e;
    }
});
