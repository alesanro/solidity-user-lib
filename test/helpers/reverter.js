function Reverter(web3) {
	const self = this

	this.snapshotId = 0

	this.revert = (done, id) => {
		const toSnapshotId = (id === undefined) ? self.snapshotId : (id <= 0 ? 1 : (id > self.snapshotId ? self.snapshotId : id))

		web3.currentProvider.sendAsync({
			jsonrpc: "2.0",
			method: "evm_revert",
			id: new Date().getTime(),
			params: [toSnapshotId,],
		}, err => {
			if (err) {
				done(err)
			}
			else {
				self.snapshot(done)
			}
		})
	}

	this.snapshot = done => {
		web3.currentProvider.sendAsync({
			jsonrpc: "2.0",
			method: "evm_snapshot",
			id: new Date().getTime(),
		}, (err, result) => {
			if (err) {
				done(err)
			}
			else {
				self.snapshotId = web3.toDecimal(result.result)
				done()
			}
		})
	}

	this.promisifyRevert = id => {
		return new Promise((resolve, reject) => {
			self.revert(err => {
				if (err) {
					return reject(err)
				}
				resolve()
			}, id)
		})
	}

	this.promisifySnapshot = () => {
		return new Promise((resolve, reject) => {
			self.snapshot(err => {
				if (err) {
					return reject(err)
				}
				resolve()
			})
		})
	}
}

module.exports = Reverter
