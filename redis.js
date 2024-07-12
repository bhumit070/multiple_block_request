const Redis = require('ioredis')

const EventEmitter = require('./events')

const redisClient = new Redis()
const subscriber = redisClient.duplicate()
const publisher = redisClient.duplicate()

function handleApiResponse({ api, data }) {
	const pendingRequests = global.pendingRequests[api]

	if (!pendingRequests || !pendingRequests?.length) {
		return
	}

	while (pendingRequests.length) {
		const res = pendingRequests.pop()
		res.status(200).json(data)
	}

}

subscriber.subscribe('api_response')

subscriber.on('message', (channel, message) => {

	if (channel === 'api_response') {
		const data = JSON.parse(message)
		handleApiResponse(data)
		return
	}

	console.log('message', channel, message)
})


module.exports = { redisClient, publisher }