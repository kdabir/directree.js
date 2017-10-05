const fs = require('fs');
const mkdirp = require('mkdirp');
const join = require('path').join;

const directree = (tree, root = ".") => {
  mkdirp(root);
  if (typeof tree === 'object') {
    Object.entries(tree).forEach(([name, value]) => {
      const path = join(root, name);
      if (typeof value === 'string' && !fs.existsSync(path)) {
        fs.writeFileSync(path, value);
      }
      if (typeof value === 'object') {
        directree(value, path)
      }
    })
  }
};

module.exports = directree;
