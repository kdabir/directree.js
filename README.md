# directree.js

Create directory trees with files and content

[![Build Status](https://travis-ci.org/kdabir/directree.js.svg?branch=master)](https://travis-ci.org/kdabir/directree.js) [![Greenkeeper badge](https://badges.greenkeeper.io/kdabir/directree.js.svg)](https://greenkeeper.io/)

## Install

`npm install directree.js`


## Usage


```javascript
const directree = require('directree.js')

directree({
  '.gitignore': 'node_modules',
  'README.md': '# my project',
  'index.js': 'module.exports = () => "hello"',
  'spec': {
    'index.spec.js':'const hello = require("../index");',
  },
});
```


Pass file tree representation as a simple json object to 
`directree(json, root)`. 

Keys are used as file/dir name. If the value is of type string type, 
a file will be created. If value is an object, 
directory will be created. 

We can optionally pass root directory. If not passed "." is used 
as default. 
