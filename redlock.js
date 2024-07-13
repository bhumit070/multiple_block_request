const express = require('express')
const Client = require("ioredis");
const Redlock = require("redlock").default;

const redisClient = new Client();

redisClient.on('ready', () => {
	console.log('Redis is ready')
})

const redLock = new Redlock([redisClient], {
	// The expected clock drift; for more details see:
	driftFactor: 0.01, // multiplied by lock ttl to determine drift time
	// ∞ retries
	retryCount: -1,
	// the time in ms between attempts
	retryDelay: 200, // time in ms
	// the max time in ms randomly added to retries
	// to improve performance under high contention
	retryJitter: 200, // time in ms
	// The minimum remaining time on a lock before an extension is automatically
	// attempted with the `using` API.
	automaticExtensionThreshold: 500, // time in ms
});

const app = express()

const PORT = process.env.PORT

if (!PORT) {
	throw new Error('PORT is not defined')
}

async function sleep(seconds) {
	return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}

app.get('/', async (req, res) => {
	const id = +req.query.id
	const api_hash_key = `${req.path}?id=${id}`
	const api_hash_value_key = `${api_hash_key}:value`
	let lock;
	try {
		// lock the api_hash_key
		const lockKey = `${api_hash_value_key}_lock`
		lock = await redLock.acquire([lockKey], 2 * 1000) // TODO: set appropriate TTL as per api timeout.
		console.log(`Lock acquired ${PORT} - ${lockKey}`)
		const api_hash_value = await redisClient.get(api_hash_value_key)
		if (api_hash_value) {
			return res.status(200).json({ id })
		}

		await sleep(id)
		await redisClient.set(api_hash_value_key, true)
		res.status(200).json({ id })
	} catch (error) {
		console.error(error)
		res.status(500).json({ error })
	} finally {
		console.log('finally called.')
		console.log(lock.expiration, Date.now())
		if (lock) {
			console.log(`Trying to release lock ${lock.value} ${PORT}`)
			await lock.release()
			console.log(`Lock released`)
		} else {
			console.log('Lock not acquired')
		}
	}
})

app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`)
})