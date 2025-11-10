const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    popup: './popup.js',
    dashboard: './dashboard.js',
    settings: './settings.js',
    background: './scripts/background.js',
    content: './scripts/content.js',
    theme: './scripts/theme.js',
    fontSize: './scripts/fontSize.js',
    notification: './scripts/notification.js',
    highlight: './scripts/highlight.js',
    floatButton: './scripts/floatButton.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'popup.html', to: 'popup.html' },
        { from: 'dashboard.html', to: 'dashboard.html' },
        { from: 'settings.html', to: 'settings.html' },
        { from: 'styles', to: 'styles' },
        { from: 'icons', to: 'icons' },
        { from: 'scripts/supabase.js', to: 'scripts/supabase.js' },
        { from: 'scripts/theme.js', to: 'scripts/theme.js' },
        { from: 'scripts/fontSize.js', to: 'scripts/fontSize.js' },
        { from: 'scripts/notification.js', to: 'scripts/notification.js' },
        { from: 'scripts/highlight.js', to: 'scripts/highlight.js' },
        { from: 'scripts/floatButton.js', to: 'scripts/floatButton.js' }
      ]
    })
  ],
  mode: 'development',
  devtool: 'cheap-module-source-map'
};

