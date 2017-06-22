import { camelCase, forEach, forOwn, isString } from 'lodash';

import { workspace, notifications, config, packages } from 'atom'
import shell from 'shell'

import UrlReplace from './UrlReplace';

class Item {
    constructor(options) {
        this.state = {
            style:  options.style,
            hide:   options.hide,
            show:   options.show,
            enable: options.enable
        }
        this.className = options.className
        this.disable   = options.disable
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

    setElement(button) {
        this.element = button.element
        this.addStyles()
        this.addClass()
        return this
    }
}

class ButtonItem extends Item {
    constructor(options) {
        super(options)
        this.icon     = options.icon
        this.tooltip  = options.tooltip
        this.iconset  = options.iconset
        this.priority = options.priority || 45
        this.callback = options.callback
    }

    addTo(toolbar) {
        return this.setElement(toolbar.addButton(this))
    }
}

class SpacerItem extends Item {
    constructor(options) {
        super(options)
        this.priority = options.priority || 45
    }

    addTo(toolbar) {
        return this.setElement(toolbar.addSpacer(this))
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
