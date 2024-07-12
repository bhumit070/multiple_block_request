const Redis = require('ioredis')
const express = require('express')
const EventEmitter = require('./events')
const { redisClient, publisher } = require('./redis')

async function sleep(seconds) {
	return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}

global.pendingRequests = {}

async function main() {


	const app = express()

	const PORT = process.env.PORT

	if (!PORT) {
		throw new Error('PORT is not defined')
	}

	app.get('/', async (req, res) => {
		const id = +req.query.id
		const api_hash_key = `${req.path}?id=${id}`
		try {
			const api_hash_value_key = `${api_hash_key}:value`
			const api_hash_value = await redisClient.get(api_hash_value_key)

			if (api_hash_value) {
				return res.status(200).json({ id })
			}

			const isRequestPending = await redisClient.exists(api_hash_key)

			if (isRequestPending) {
				if (!global.pendingRequests[api_hash_key]) {
					global.pendingRequests[api_hash_key] = []
				}
				global.pendingRequests[api_hash_key].push(res)
				return;
			}

			await redisClient.set(api_hash_key, true) // TODO: set appropriate TTL as per api timeout.
			await sleep(id)
			await redisClient.set(api_hash_value_key, true)
			publisher.publish('api_response', JSON.stringify({
				api: api_hash_key,
				data: { id }
			}))
			res.status(200).json({ id })
		} catch (error) {
			console.error(error)
			res.status(500).json({ error })
		} finally {
			console.log({ api_hash_key })
			await redisClient.del(api_hash_key)
		}
	})

	app.listen(PORT, () => {
		console.log(`Server is running on port ${PORT}`)
	})
}


main()