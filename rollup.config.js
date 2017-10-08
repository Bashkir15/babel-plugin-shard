const { rollup } = require('rollup');
const commonjs = require('rollup-plugin-commonjs');

function createBundle(bundle, type) {
    return rollup({
        input: 'src/index.js',
        plugins: [
            commonjs()
        ]
    })
    .then(result => result.write({
        file: 'index.js',
        format: 'cjs',
        interop: false
    }))
    .then(() => console.log('complete:'))
    .catch(error => {
        if (error.code) {
            console.error(`\x1b[31m-- ${error.code} (${error.plugin}) --`);
            console.error(error.message);
            console.error(error.loc);
            console.error(error.codeFrame);
        } else {
            console.error(error);
        }

        process.exit(1);
    });
}

createBundle();
