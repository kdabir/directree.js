const directree = require('directree.js')

directree({
  '.gitignore': 'node_modules',
  'README.md': '# my project',
  'index.js': 'module.exports = () => "hello"',
  'spec': {
    'index.spec.js':'const hello = require("../index");',
  },
}, "out");
