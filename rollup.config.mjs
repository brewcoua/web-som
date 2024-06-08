import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import { string } from 'rollup-plugin-string';

export default {
	input: 'src/main.ts',
	output: [
		{
			file: 'dist/SoM.js',
			format: 'cjs',
			sourcemap: true,
		},
		{
			file: 'dist/SoM.min.js',
			format: 'cjs',
			sourcemap: true,
			plugins: [terser()],
		},
	],
	plugins: [
		typescript(),
		string({
			include: '**/*.css',
			exclude: ['node_modules/**'],
		}),
	],
};
