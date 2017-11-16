"use strict";
const config = require('config')
const fs = require('fs')
const path = require('path')
const request = require('request-promise')

function EmpathClient(){}

EmpathClient.prototype.analyze = (file) => {
    return new Promise(function(resolve, reject) {
        const apiKey = config.get('Empath.apiKey')
        const endPoint = config.get('Empath.endPoint')
        const formData = {
            apikey: apiKey,
            wav: fs.createReadStream(file)
        };
        return request.post({ url: endPoint, formData: formData })
        .then(function(response) {
            var result = JSON.parse(response)
            result.file = path.basename(file, path.extname(file))
            resolve(result)
        }).catch(function(err){
            reject(err)
        })
    })
}

module.exports = EmpathClient
