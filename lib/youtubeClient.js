"use strict";
const config = require('config')
const fs = require('fs')
const path = require('path')
const searchImpl = require('youtube-search')
const ytdl = require('ytdl-core')


function YoutubeClient(){}

YoutubeClient.prototype.opts = config.get('Youtube.ClientOptions')
YoutubeClient.prototype.search = (keyword) => {
    return new Promise(function(resolve, reject) {
        const searchWord = keyword || 'Anger'
        searchImpl(searchWord, YoutubeClient.prototype.opts, (err, results) => {
            if(err){
                reject(err)
                return
            }
            var result = []
            results.forEach((e,i,a)=>{
                var tmp = {}
                tmp.url = e.link
                tmp.title = e.title
                result.push(tmp)
            })
            resolve(result)
        })
    })
}

YoutubeClient.prototype.download = (url, pgCallback) => {
    return new Promise(function(resolve, reject) {
        const baseDir = config.get('Youtube.dlDirectory')
        const video = ytdl(url)
        const outDir = path.resolve(__dirname, baseDir)
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir)
        }
        const out = path.resolve(__dirname, baseDir + ytdl.getURLVideoID(url) + ".mp4")
        video.pipe(fs.createWriteStream(out))
        video.on('progress', (chunkLength, downloaded, total) => {
            pgCallback(url, chunkLength, downloaded, total)
        })
        video.on('end', () => {
           resolve(out)
        })
    })
}

module.exports = YoutubeClient
