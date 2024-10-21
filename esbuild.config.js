// esbuild.config.js
const esbuild = require('esbuild');
const copyPlugin = require('esbuild-plugin-copy').copy;

esbuild.build({
  entryPoints: {
    background: './src/background.ts',
    content_script: './src/content_script.ts',
    popup: './src/popup.ts',
    blocked: './src/blocked.ts'
  },
  outdir: 'dist',
  bundle: true,
  sourcemap: true,
  minify: true,
  platform: 'browser',
  target: 'es2020',
  legalComments: "none",
  plugins: [
    copyPlugin({
      resolveFrom: 'cwd',
      assets: {
        from: ['./src/*.html', './src/*.css', './src/logo.png', './src/manifest.json'],
        to: './dist/',
      }
    })
  ],
  loader: {
    '.ts': 'ts',
  }
}).catch(() => process.exit(1));
