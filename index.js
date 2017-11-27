const inquirer = require("inquirer")
const Command = require('./lib/cmd.js')

const cmdsList = {
    'type': 'list',
    'name': 'cmd',
    'message': '何をしますか?',
    'choices': ['download','convert', 'empath', 'exit']
}

const cmds = {
    'download': Command.download,
    'convert': Command.video2wav,
    'empath': Command.empath,
    'exit': ()=>{}
}

function menu() {
    inquirer.prompt([cmdsList]).then((answer) =>{
        cmds[answer.cmd](menu)
    })
}

menu()
