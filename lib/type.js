import { camelCase, forEach, forOwn, isFunction, isObject, isString, keys, map, pick } from 'lodash';

import { workspace, notifications, config, packages, commands, views } from 'atom'
import shell from 'shell'

import UrlReplace from './UrlReplace';

class Item {
    constructor(options, toolbar) {
        this.toolbar   = toolbar
        this.style     = options.style
        this.className = options.className
        this.state     = {}

        forOwn(pick(options, ['hide', 'show', 'enable', 'disable']), (val, key) => {
            this.state[key] = this.createPatterns(val)
        })
    }

    createPatterns(patterns) {
        if (isString(patterns)) {
            return [this.createPattern(patterns)]
        }

        return map(patterns, p => this.createPattern(p))
    }

    createPattern(p) {
        return new RegExp('^' + p + '($|\\b)')
    }

    hide(isHide) {
        this.element.style('display', isHide ? 'none' : 'initial')
    }

    disable(isDisabled) {
        this.element.disabled = isDisabled
    }

    display(condition, revCondition) {
        this.hide((this.state.hide && condition) || (this.state.show && !revCondition))
    }

    visible(condition, revCondition) {
        this.hide((this.state.disable && condition) || (this.state.enable && !revCondition))
    }

    addStyles() {
        forOwn(this.styles, (val, propName) => {
            this.element.style(camelCase(propName), val)
        })
    }

    addClass() {
        if (isString(this.classNames)) {
            forEach(this.classNames.split(','), className => {
                this.element.classList.add(className.trim())
            })
        }
    }

    render() {
        this.element = this.toolBarButton.element
        this.addStyles()
        this.addClass()
    }

}

const isPlanObject = item => !isFunction(item) && isObject(item)

class ButtonItem extends Item {
    constructor(options, toolBar, customToolBar) {
        super(...arguments)
        this.customToolBar = customToolBar
        this.icon          = options.icon
        this.tooltip       = options.tooltip
        this.iconset       = options.iconset
        this.priority      = options.priority || 45
        this.callback      = options.callback
    }

    parseCallback() {
        if (!isPlanObject(this.callback)) {
            return
        }

        forOwn(this.callback, (val, key, callback) => {
            if (!isPlanObject(val)) {
                return
            }

            const cmdByGrammar = {}
            forOwn(val, (grammar, cmd) => {
                cmdByGrammar[cmd] = this.createPattern(grammar)
            })

            callback[key] = function() {
                const cmdByGrammarKeys = keys(cmdByGrammar)

                for (let i = cmdByGrammarKeys.length; i--;) {
                    const cmdByGrammarKey = cmdByGrammarKeys[i]
                    if (this.customToolBar.checkGrammar(cmdByGrammarKey)) {
                        const workspaceView = views.getView(workspace)
                        commands.dispatch(workspaceView, cmdByGrammar[cmdByGrammarKey])
                    }
                }
            }
        })
    }

    render() {
        this.toolBarButton = this.toolbar.addButton(this)
        super.render()
    }
}

class SpacerItem extends Item {
    constructor(options) {
        super(options)
        this.priority = options.priority || 45
    }

    render() {
        this.toolBarButton = this.toolbar.addSpacer(this)
        super.render()
    }
}

class FunctionItem extends ButtonItem {
    constructor(options) {
        super(options)
        this.data     = options.callback
        this.callback = (data, target) => {
            data(target)
        }
    }
}

class UrlItem extends ButtonItem {
    constructor(options) {
        super(options)
        this.data     = options.url
        this.callback = url => {
            const urlReplace = new UrlReplace()
            url = urlReplace.replace(url)
            if (url.startsWith('atom://')) {
                return workspace.open(url)
            } else if (config.get('flex-tool-bar.useBrowserPlusWhenItIsActive')) {
                if (packages.isPackageActive('browser-plus')) {
                    return workspace.open(url, {split: 'right'})
                }
                const warning = 'Package browser-plus is not active. Using default browser instead!'
                options = {detail: 'Use apm install browser-plus to install the needed package.'}
                notifications.addWarning(warning, options)
                return shell.openExternal(url)

            }
            return shell.openExternal(url)
        }
    }
}

export default {button: ButtonItem, function: FunctionItem, spacer: SpacerItem, url: UrlItem}
