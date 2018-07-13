var HDWalletProvider = require("truffle-hdwallet-provider");
function getWallet(){
    try{
        return require('fs').readFileSync("./wallet.json", "utf8").trim();
    } catch(err){
        return "";
    }
}

module.exports = {
    networks: {
        development: {
            host: 'localhost',
            port: 8545,
            network_id: '*', // Match any network id
            gas: 4700000,
        },
        ntr1x: {
            network_id: 0x58,
            provider: new HDWalletProvider(getWallet(),'test_pa$$','https://node2.parity.tp.ntr1x.com:8545'),
            gas: 4700000,
            gasPrice: 1000000000,
        },
        "private": {
			network_id: 74565,
			network_uri_test: "http://127.0.0.1:8540",
			provider: new HDWalletProvider(getWallet(), 'test_pa$$', "http://127.0.0.1:8540"),
			gasPrice: 0,
            gas: 4700000,
            gasPrice: 1000000000,
		},
        // rinkeby:{
        //     network_id:4,
        //     provider: new HDWalletProvider(getWallet(),'QWEpoi123','https://rinkeby.infura.io/'),
        //     gas: 4700000
        // },
    },

    solc: {
        optimizer: {
            enabled: true,
            runs: 200,
        },
    },
    migrations_directory: './migrations'
}
