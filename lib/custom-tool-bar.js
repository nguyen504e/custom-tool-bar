'use babel'

// import CustomToolBarView from './custom-tool-bar-view';
import { camelCase, forEach, forOwn, get, isString } from 'lodash';
import chokidar from 'chokidar'

import CSON from 'cson'
import atom, { workspace, commands, notifications, configDirPath, config } from 'atom';
import fs from 'fs'
import path from 'path'

const defaultConfig = `
# This file is used by Flex Tool Bar to create buttons on your Tool Bar.
# For more information how to use this package and create your own buttons,
# read the documentation on https://atom.io/packages/flex-tool-bar

[
    {
        type: "button"
        icon: "gear"
        callback: "flex-tool-bar:edit-config-file"
        tooltip: "Edit Tool Bar"
    }
    {
        type: "spacer"
    }
]`

export default class CustomToolBar {

    // customToolBarView: null,
    // modalPanel: null,
    // subscriptions: null
    toolBar = null
    configFilePath = null
    currentGrammar= null
    currentProject = null
    buttonTypes = []
    watchList=  []
    config = {
        toolBarConfigurationFilePath: {
            type:      'string',
            'default': ''
        },
        reloadToolBarWhenEditConfigFile: {
            type:      'boolean',
            'default': true
        },
        useBrowserPlusWhenItIsActive: {
            type:      'boolean',
            'default': false
        }
    }

    consumeToolBar(toolBar) {
        this.toolBar = toolBar('custom-tool-bar')
        return this.reloadToolbar(false)
    }

    resolveConfigPath() {
        this.configFilePath = path.join(configDirPath, 'toolbar.cson')
        try {
            fs.writeFileSync(this.configFilePath, defaultConfig)
            notifications.addInfo('We created a Tool Bar config file for you...', {
                detail: this.configFilePath
            })
            return true
        } catch (e) {
            this.configFilePath = null
            notifications.addError('Something went wrong creating the Tool Bar config file! Please restart Atom to try again.')
            console.error(e)
            return false
        }

    }

    getActiveTextEditor() {
        return workspace.getActiveTextEditor()
    }

    getGrammar() {
        const editor  = this.getActiveTextEditor()
        const grammar = editor && editor.getGrammar()
        return grammar && grammar.name.toLowerCase()
    }

    storeGrammar() {
        this.currentGrammar = this.getGrammar()
    }

    registerCommand() {
        return this.subscriptions.add(commands.add('atom-workspace', {
            'flex-tool-bar:edit-config-file': configFilePath => configFilePath && workspace.open(configFilePath)
        }))
    }

    registerEvent() {
        return this.subscriptions.add(workspace.onDidChangeActivePaneItem(() => {
            if (this.didChangeGrammar()) {
                this.storeGrammar()
                forEach(this.buttons, btn => this.processButtonState(btn))
                return
            }
        }))
    }

    registerWatch() {
        if (config.get('flex-tool-bar.reloadToolBarWhenEditConfigFile')) {
            const watcher = chokidar.watch(this.configFilePath).on('change', () => this.reloadToolbar(true))
            return this.watcherList.push(watcher)
        }
    }

    getToolbarView() {
        return this.toolBar.toolBarView || this.toolBar.toolBar
    }

    fixToolBarHeight() {
        return this.getToolbarView().element.style.height = `${this.getToolbarView().element.offsetHeight}px`
    }

    loadConfig() {
        return CSON.requireCSONFile(this.configFilePath)
    }

    removeButtons() {
        if (this.toolBar) {
            return this.toolBar.removeItems()
        }
    }

    grammarCondition(grammars) {
        let activePath,
            filePath,
            grammar,
            grammarType,
            j,
            len,
            options,
            ref,
            ref1,
            result,
            reverse,
            tree
        result      = false
        grammarType = Object.prototype.toString.call(grammars)
        if (grammarType === '[object String]' || grammarType === '[object Object]') {
            grammars = [grammars]
        }
        filePath = (ref = atom.workspace.getActiveTextEditor()) != null ? ref.getPath() : void 0
        for (j = 0, len = grammars.length; j < len; j++) {
            grammar = grammars[j]
            reverse = false
            if (Object.prototype.toString.call(grammar) === '[object Object]') {
                if (!treeIsInstalled) {
                    atom.notifications.addError('[Tree](http://mama.indstate.edu/users/ice/tree/) is not installed, please install it.')
                    continue
                }
                if (filePath === void 0) {
                    continue
                }
                activePath = this.getActiveProject()
                options    = grammar.options ? grammar.options : {}
                tree       = treeMatch(activePath, grammar.pattern, options)
                if (Object.prototype.toString.call(tree) === '[object Array]' && tree.length > 0) {
                    return true
                }
            } else {
                if (/^!/.test(grammar)) {
                    grammar = grammar.replace('!', '')
                    reverse = true
                }
                if (/^[^\/]+\.(.*?)$/.test(grammar)) {
                    if (filePath !== void 0 && ((ref1 = filePath.match(grammar)) != null ? ref1.length : void 0) > 0) {
                        result = true
                    }
                } else {
                    if ((this.currentGrammar != null) && this.currentGrammar.includes(grammar.toLowerCase())) {
                        result = true
                    }
                }
            }
            if (reverse) {
                result = !result
            }
            if (result === true) {
                return true
            }
        }
        return false
    }

    processButtonState(button) {
        button.display(this.grammarCondition(button.state.hide), this.grammarCondition(button.state.show))
        button.visible(this.grammarCondition(button.state.disable), this.grammarCondition(button.state.enable))
    }

    addButtons(toolBarButtons) {
        if (!toolBarButtons) {
            return
        }

        const devMode = atom.inDevMode()
        const results = []
        forEach(toolBarButtons, btn => {
            if (btn.mode && btn.mode === 'dev' && !devMode) {
                return
            }
            const ItemClass = this.buttonTypes[btn.type]
            if (!ItemClass) {
                return
            }

            const btnConfig = new ItemClass(btn)
            const button    = btnConfig.addTo(this.toolBar)

            if (btn.mode) {
                button.element.classList.add(`tool-bar-mode-${btn.mode}`)
            }

            this.processButtonState(button)

            results.push(button)
        })

        return results
    }

    unfixToolBarHeight() {
        return this.getToolbarView().element.style.height = null
    }

    reloadToolbar(withNotification) {
        withNotification = withNotification === false ? false : true

        if (this.toolBar === null) {
            return
        }

        try {
            this.fixToolBarHeight()
            const toolBarButtons = this.loadConfig()
            this.removeButtons()
            this.buttons = this.addButtons(toolBarButtons)
            if (withNotification) {
                notifications.addSuccess('The tool-bar was successfully updated.')
            }
            return this.unfixToolBarHeight()
        } catch (error) {
            this.unfixToolBarHeight()
            notifications.addError('Your `toolbar.json` is **not valid JSON**!')
            return console.error(error)
        }
    }

    activate() {
        if (!this.resolveConfigPath()) {
            return
        }

        this.storeGrammar()
        this.registerCommand()
        this.registerEvent()
        this.registerWatch()
        this.reloadToolbar(false)

    // this.customToolBarView = new CustomToolBarView(state.customToolBarViewState);
    // this.modalPanel = atom.workspace.addModalPanel({
    //   item: this.customToolBarView.getElement(),
    //   visible: false
    // });
    //
    // // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    // this.subscriptions = new CompositeDisposable();
    //
    // // Register command that toggles this view
    // this.subscriptions.add(atom.commands.add('atom-workspace', {
    //   'custom-tool-bar:toggle': () => this.toggle()
    // }));
    }

    deactivate() {
        // this.modalPanel.destroy();
        // this.subscriptions.dispose();
        // this.customToolBarView.destroy();
    }

    serialize() {
        // return {
        //   customToolBarViewState: this.customToolBarView.serialize()
        // };
    }

    // toggle() {
    //     console.log('CustomToolBar was toggled!')
    //     return (
    //     this.modalPanel.isVisible() ?
    //         this.modalPanel.hide() :
    //         this.modalPanel.show()
    //     )
    // }

}
