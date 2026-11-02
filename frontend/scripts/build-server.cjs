const path = require('node:path');
const fs = require('node:fs');
process.env.NODE_ENV = 'production';
process.env.BABEL_ENV = 'production';
const webpack = require('webpack');

webpack({
  mode: 'production', target: 'node22',
  entry: path.resolve(__dirname, '../src/server/renderPage.jsx'),
  output: { path: path.resolve(__dirname, '../server-build'), filename: 'renderer.cjs', library: {type: 'commonjs2'}, clean: true },
  resolve: {extensions: ['.js','.jsx','.json'],alias: {'@': path.resolve(__dirname,'../src')}},
  module: {rules: [
    {test: /\.jsx?$/,include: path.resolve(__dirname,'../src'),use: {loader: require.resolve('babel-loader'),options: {presets: [[require.resolve('babel-preset-react-app'),{runtime:'automatic'}]],babelrc:false,configFile:false}}},
    {test: /\.css$/,use: path.resolve(__dirname,'ignore-server-style.cjs')},
    {test: /\.(?:svg|png|webp|jpg|woff2)$/,type:'asset/resource'},
  ]},
  optimization: {minimize: true, splitChunks: false},
  devtool: false,
}, (error, stats) => {
  if (error || stats.hasErrors()) {
    process.stderr.write(error ? `${error.message}\n` : stats.toString({all:false,errors:true,errorDetails:true}));
    process.exitCode = 1;
    return;
  }
  const template = fs.readFileSync(path.resolve(__dirname, '../build/index.html'), 'utf8');
  fs.writeFileSync(path.resolve(__dirname, '../server-build/template.html'), template);
  const adminShell = template.replace(/<meta\s+name="robots"\s+content="[^"]*"\s*\/?\s*>/i, '<meta name="robots" content="noindex, nofollow" />');
  fs.writeFileSync(path.resolve(__dirname, '../build/admin-shell.html'), adminShell);
  // Vercel resolves static files before rewrites. A static index.html would
  // otherwise bypass runtime rendering for the homepage.
  fs.unlinkSync(path.resolve(__dirname, '../build/index.html'));
  process.stdout.write(`Public server renderer: ${stats.toString({all:false,assets:true,timings:true})}\n`);
});
