export default {
	branches: ['master'],
	plugins: [
		[
			'@semantic-release/commit-analyzer',
			{
				preset: 'conventionalcommits',
			},
		],
		'@semantic-release/release-notes-generator',
		'@semantic-release/changelog',
		[
			'@semantic-release/exec',
			{
				prepareCmd: 'mkdir -p dist && cp package.json README.md LICENSE* dist',
			},
		],
		[
			'@semantic-release/npm',
			{
				npmPublish: true,
				pkgRoot: 'dist',
			},
		],
		[
			'@semantic-release/git',
			{
				prepareCmd: 'cp dist/package.json package.json',
			},
		],
		[
			'@semantic-release/github',
			{
				assets: 'dist/*.js',
			},
		],
	],
};
