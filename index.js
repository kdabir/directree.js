const fs = require('fs')
  , mkdirp = require('mkdirp')
  , {dirname, join} = require('path')
;

const directree = (tree, opts ) => {

  const {root = ".", overwrite = false} =
    (typeof opts === 'object') ? opts :
      ((typeof opts === 'string') ? {root: opts} :
        {})

  mkdirp.sync(root);

  if (typeof tree === 'object') {
    Object.entries(tree).forEach(([name, value]) => {
      const path = join(root, name);

      if (typeof value === 'string' && (overwrite || !fs.existsSync(path))) {
        mkdirp.sync(dirname(path)); // for non existent paths as keys
        fs.writeFileSync(path, value);
      } else if (typeof value === 'object') {
        directree(value, {...opts, root:path})
      }
    })
  }
};

module.exports = directree;
