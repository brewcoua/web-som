import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

import terser from '@rollup/plugin-terser';
import { string } from 'rollup-plugin-string';

export default {
	input: 'src/main.ts',
	output: [
		{
			file: 'dist/SoM.js',
			format: 'umd',
			sourcemap: true,
		},
		{
			file: 'dist/SoM.min.js',
			format: 'umd',
			sourcemap: true,
			plugins: [terser()],
		},
	],
	plugins: [
		typescript({
			outputToFilesystem: true,
			noEmitOnError: true,
		}),
		resolve(),
		commonjs(),
		string({
			include: '**/*.css',
			exclude: ['node_modules/**'],
		}),
	],
};
