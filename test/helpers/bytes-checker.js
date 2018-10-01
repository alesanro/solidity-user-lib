const Buffer = require('buffer').Buffer

module.exports = (function() {

	const Gcopy = 3
	const Gverylow = 3
	const Gmemory = 3
	const ZERO_BYTES_PRICE = 4
	const NON_ZERO_BYTES_PRICE = 68
	const WORD = 32 // in bytes (256-bit word)

	const self = this

	this.countBytesInString = function (str) {
		const buffer = Buffer.from(str, 'hex')
		var zeroBytes = 0, nonZeroBytes = 0

		for (let index = 0; index < buffer.length; index++) {
			const element = buffer.readUInt8(index)
			if (element === 0) {
				zeroBytes += 1
			}
			else {
				nonZeroBytes += 1
			}
		}

		return {
			length: buffer.length,
			zeroBytes: zeroBytes,
			nonZeroBytes: nonZeroBytes,
		}
	}

	this.calldatacopyGas = function(calldata) {
		const buffer = Buffer.from(calldata, 'hex')

		return Gverylow + Gcopy * Math.pow(Gmemory, 0.75) * (buffer.length)/ WORD
	}

	this.inputDataGas = function(calldata) {
		const { zeroBytes, nonZeroBytes, length, } = self.countBytesInString(calldata)
		return {
			external: zeroBytes * ZERO_BYTES_PRICE + nonZeroBytes * NON_ZERO_BYTES_PRICE,
			contract: length * 0.3 * NON_ZERO_BYTES_PRICE + length * 0.7 * 4,
		}
	}
})