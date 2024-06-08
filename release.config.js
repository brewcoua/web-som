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
				prepareCmd: 'cp package.json README.md LICENSE* dist',
			},
		],
		'@semantic-release/git',
		[
			'@semantic-release/github',
			{
				assets: 'dist/*.js',
			},
		],
		[
			'@semantic-release/npm',
			{
				npmPublish: true,
				pkgRoot: 'dist',
			},
		],
	],
};
