import {  some } from 'lodash';

import atom, { project,  workspace } from 'atom';

export default class UrlReplace {
    constructor() {
        const repository = this.getRepositoryForActiveItem()
        this.repoInfo = this.parseUrl(repository && repository.getOriginURL())

        this.info = {
            'repo-name':    this.repoInfo.name,
            'repo-owner':   this.repoInfo.owner,
            'atom-version': atom.getVersion()
        }
    }
    replace(url) {
        let matchedText
        const re = /({[^}]*})/
        let m    = re.exec(url)
        while (m) {
            matchedText = m[0]
            url         = url.replace(m[0], this.getInfo(matchedText))
            m           = re.exec(url)
        }
        return url
    }

    getInfo(key) {
        key = key.replace(/{([^}]*)}/, '$1')
        if (this.info[key] !== null || this.info[key] !== undefined) {
            return this.info[key]
        }
        return key

    }

    getRepositoryDetail() {
        return project.getRepositories()
    }

    getActiveItemPath() {
        const activeItem = this.getActiveItem()
        return activeItem && activeItem.getPath()
    }

    getRepositoryForActiveItem() {
        const rootDir      = project.relativizePath(this.getActiveItemPath())[0]
        const rootDirIndex = project.getPaths().indexOf(rootDir)

        if (rootDirIndex >= 0) {
            return project.getRepositories()[rootDirIndex]
        }
        some(project.getRepositories(), repo => repo)
    }

    getActiveItem() {
        return workspace.getActivePaneItem()
    }

    parseUrl(url) {
        let re
        const repoInfo = {owner: '', name: ''}

        if (!url) {
            return repoInfo
        }
        if (url.indexOf('http' >= 0)) {
            re = /github\.com\/([^\/]*)\/([^\/]*)\.git/
        }

        if (url.indexOf('git@') >= 0) {
            re = /:([^\/]*)\/([^\/]*)\.git/
        }

        const m = re.exec(url)
        if (m) {
            return {owner: m[1], name: m[2]}
        }
        return repoInfo
    }
}
