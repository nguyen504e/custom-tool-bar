'use babel'

// import CustomToolBarView from './custom-tool-bar-view';
import {  forEach } from 'lodash';
import chokidar from 'chokidar'

import CSON from 'cson'
import atom, { workspace, commands, notifications, configDirPath, config, CompositeDisposable } from 'atom';
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
        return grammar && grammar.scopeName
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
        if (!grammars) {
            return
        }

        return grammars.some(pattern => this.checkGrammar(pattern))
    }

    checkGrammar(pattern) {
        return pattern.test(this.currentGrammar)
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

            const btnConfig = new ItemClass(btn, this.toolBar)
            const button    = btnConfig.render()

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

        this.subscriptions = new CompositeDisposable()
    }

    deactivate() {
        this.watcherList.forEach(watcher => watcher.close())
        this.watcherList = null
        this.subscriptions.close()
        this.subscriptions = null
    }

    serialize() {

    }

}
