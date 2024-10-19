const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    background: './src/background.ts',
    content_script: './src/content_script.ts',
    popup: './src/popup.ts',
    blocked: './src/blocked.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  resolve: {
    extensions: ['.ts', '.js'],
    fallback: {
      "crypto": false
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        enforce: 'pre',
        test: /\.js$/,
        loader: 'source-map-loader',
      },
    ],
  },
  mode: 'development',
  devtool: 'source-map',  // Use inline source maps for better accuracy
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/popup.html', to: '.' },
        { from: 'src/blocked.html', to: '.' },
        { from: 'src/popup.css', to: '.' },
        { from: 'src/blocked.css', to: '.' }
      ],
    }),
  ],
};
