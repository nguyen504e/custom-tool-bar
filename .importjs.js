const _  = require('lodash')



module.exports = {
    environments: [
        'browser'
    ],
    importDevDependencies: true,
    namedExports:          {
        lodash: _.keys(_)
    }
}
