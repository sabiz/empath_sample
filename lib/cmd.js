"use strict";
const colors = require('colors/safe')
const config = require('config')
const csv = require('csv-stringify-as-promised')
const ffmpeg = require('fluent-ffmpeg')
const fs = require('fs')
const inquirer = require("inquirer")
inquirer.registerPrompt('file', require('inquirer-file-path'))
inquirer.registerPrompt('directory', require('inquirer-directory'))
const logUpdate = require('log-update')
const path = require('path')
const Table = require('cli-table')


const YoutubeClient = require('./youtubeClient.js')
const youtube = new YoutubeClient()
const EmpathClient = require('./empathClient.js')
const empath = new EmpathClient()


function cmdDownload(callback) {
    inquirer.prompt({
        'type': 'input',
        'name': 'keyword',
        'message': '検索キーワード',
    }).then((args) =>{
       return youtube.search(args.keyword)
           .then((urls) =>{
               console.log("Results -----")
               var dlList = []
               var progress = {}
               var lastUpdateTime = new Date().getTime()
               for(const item of urls) {
                   console.log(colors.underline("title: "), colors.bold(item.title))
                   console.log(colors.underline("  URL: "), colors.italic(item.url))
                   dlList.push(youtube.download(item.url,(url, chunk, downloaded, total)=>{
                       var currentTime = new Date().getTime()
                       if(currentTime < lastUpdateTime + 250 && downloaded !== total) return
                       progress[url] = `${url} --- ${(downloaded / total * 100).toFixed(1)}%`
                       var text = ""
                       Object.keys(progress).forEach((e,i,a)=>{text += `${progress[e]}\n`})
                       logUpdate(text)
                       lastUpdateTime = currentTime
                   }))
               }
               logUpdate("準備中...")
               return Promise.all(dlList)
           }).then((out)=>{
               var text = ""
               out.forEach((e, i, a)=>{text += `${e}\n`})
               logUpdate(text)
               logUpdate.done()
               console.log("完了")
               callback()
           }).catch((error) => {
               console.log("Error :(")
               console.dir(error)
               callback()
           })
    })
}

function cmdVideo2Wav(callback) {
    let inputs = {}
    inquirer.prompt({
        type: 'file',
        name: 'file',
        message: '変換するファイルは...',
        basePath: path.resolve(__dirname,"../"),
        }).then((args) =>{
            inputs['file'] = args.file
            return inquirer.prompt({
                'type': 'input',
                'name': 'starttime',
                'message': '切り出し開始位置(秒)は',
                })
        }).then((args) =>{
            inputs['starttime'] = args.starttime
            return inquirer.prompt({
                'type': 'input',
                'name': 'endtime',
                'message': '切り出し終了位置は(秒)は',
                })
        }).then((args) =>{
            inputs['time'] = Number(args.endtime) - Number(inputs.starttime)
            process.env.FFMPEG_PATH = config.get('Ffmpeg.Path')
            const input = path.resolve(__dirname, `../${inputs.file}`)
            const outDir = path.resolve(__dirname, config.get('Ffmpeg.outDirectory'))
            const output = path.resolve(outDir, `${path.basename(input,path.extname(input))}%04d.wav`)
            if (!fs.existsSync(outDir)) {
               fs.mkdirSync(outDir);
            }
            const options = config.get('Ffmpeg.Options')
            const command = ffmpeg(input)
            command
               .output(output)
               .audioFrequency(options.audioFrequency)
               .audioChannels(options.audioChannels)
               .addOption('-f','segment',
                           '-ss', inputs.starttime,
                           '-t', inputs.time,
                           '-af',`highpass=f=${options.highpass},lowpass=f=${options.lowpass},volume=${options.volume}`,
                           '-segment_time', options.segmentTime)
               .on('end', () => {
                   logUpdate('変換中... 100%')
                   logUpdate.done()
                   console.log(`完了 :${outDir}`)
                   callback()
               }).on('progress', (info) =>{
                   logUpdate(`変換中... ${info.percent.toFixed()} %`)
               }).on('error', (err) => {
                   logUpdate.done()
                   console.dir(err);
                   callback()
               }).run()
    })
}

function cmdEmpath(callback) {
    inquirer.prompt({
        type: 'directory',
        name: 'dir',
        message: 'wavファイルのあるパスは...',
        basePath: path.resolve(__dirname,"../"),
        }).then((args) =>{
            const inputDir = path.resolve(__dirname, `../${args.dir}`)
            var fileList = []
            try{
                fileList = fs.readdirSync(inputDir).filter((file)=>fs.statSync(`${inputDir}/${file}`).isFile() && /.*\.wav$/.test(file))
                if(fileList.length <= 0){
                    console.log('wavファイルがない。。。')
                    return callback()
                }
            }catch(err){
                console.dir(err)
                return callback()
            }
            if(config.get('Restriction')) {
                console.log(`${colors.red("!!! API制限がかかる恐れがあるので、最大5ファイル分しか行いません !!!")}`)
                fileList = fileList.slice(0, 5)
            }
            var requestList = []
            for(const f of fileList) {
                requestList.push(empath.analyze(`${inputDir}/${f}`))
            }
            Promise.all(requestList)
                    .then((results)=>{
                        const table = new Table({head:
                            ['Calm','Anger','Joy','Sorrow','Energy','File']
                        })
                        results.forEach((e, i, a)=>{
                            if(e.error !== 0) {
                                console.dir(e)
                                throw new Error("Error response from Empath");
                            }
                            delete e.error
                            table.push([e.calm, e.anger, e.joy, e.sorrow, e.energy, e.file])
                        })
                        console.log(table.toString())
                        return csv(results, { header: true}).then((output)=>{
                            const outPath = path.resolve(__dirname, '../result.csv')
                            fs.writeFileSync(outPath,output)
                            console.log(`CSVファイルで↑を ${outPath} に出力しました`)
                            callback()
                        })
                    })
                    .catch((err)=>{
                        console.dir(err)
                        callback()
                    })
    })
}

const Command = {}
Command.download = cmdDownload
Command.video2wav = cmdVideo2Wav
Command.empath = cmdEmpath
module.exports = Command
