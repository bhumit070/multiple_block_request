const _EventEmitter = require('node:events')

class EventEmitter extends _EventEmitter { }

module.exports = new EventEmitter()