// User 0xfebc7d461b970516c6d3629923c73cc6475f1d13

// User 2 (rinkeby) 0x4a2d3fc1587494ca2ca9cdeb457cd94be5d96a61

web3.eth.getAccounts((e, a) => { accounts = a; console.info(accounts); })

var user = "0xfebc7d461b970516c6d3629923c73cc6475f1d13"
var user = "0x4a2d3fc1587494ca2ca9cdeb457cd94be5d96a61"

const oracle = '0xc291ebf9de0bba851f47318ee18ba7a1c71baa29'

var tempuserBackend = UserBackend.new()
tempuserBackend.then(u => u.address)



var userFactory = UserFactory.at("0x1ee64a06cd50eff93052a37bf2320f6f69d6d50e")
var userFactory = UserFactory.at("0xc84b16057a29e0f0cdbf198f9e67a775db1e159d") // private
var userFactory = UserFactory.at("0x7b6ca266fcad8a37e81808346e6903deca8abe59") // rinkeby
var recovery = Recovery.at("0x158a00c831d82e7326a1f741655fc38e8debc3bf")
var recovery = Recovery.at("0x6dfb870cf79e0f4a79406d971efbb33895b5d2a8") // private
var recovery = Recovery.at("0x3e3c0c8255c45fa913503211e67835b19273c1ed") // rinkeby
var backendProvider = UserBackendProvider.at("0x87bc110e3e466563df354db83bea3aafdc5ca1ea")
var backendProvider = UserBackendProvider.at("0xce359f62c017e9387facff1754485c1473227df9") // private
var backendProvider = UserBackendProvider.at("0x6909d8a85af8ea2fe0c3fc69a38981eff2ee8f85") // rinkeby
var roles2Library = Roles2Library.at("0xb04592f7b710c84510ff8563a9be0b35feb1cbc9")
var roles2Library = Roles2Library.at("0x62f247e3a971857e11882b9b3bf9486e6baa743e") // private
var roles2Library = Roles2Library.at("0x62f247e3a971857e11882b9b3bf9486e6baa743e") // rinkeby

var userBackend = UserBackend.at("0x673cd395b492f266dec4c89637c6b222a5258473")
var userBackend = UserBackend.at("0x7ad19beb398e471742206003eb10656d05e444f7") // 1.0.1
var userBackend = UserBackend.at("0x382b4eb7f4933652200c5f3c7f860b56629318aa") // 1.0.2
var userBackend = UserBackend.at("0xb623a42700f307232c193997e51c9f1849b4153b") // 1.0.3
var userBackend = UserBackend.at("0x76d42fed39c8abfa448b70a2fbb9e4ff91a6835d") // 1.0.4


// 0xb1b8f88dd1f70c413053dea78b35f11b2d92583b
var newUser = UserRouter.new(user, recovery.address, backendProvider.address)
var newUserAddress = "0xb1b8f88dd1f70c413053dea78b35f11b2d92583b"
newUser.then(u => newUserAddress = u.address)


// UserBase.at(newUserAddress).backendProvider()
// UserBase.at(newUserAddress).issuer()

// MultiSig.at(newUserAddress).isOwner(user)
// UserProxy.at("0xe84eec2dd60485721f300f0ded46498f0b16665d").contractOwner()

var newUserInterface = UserInterface.at(newUserAddress)
UserRouter.at(newUserInterface.address).versionRouter()
newUserInterface.getOracle()
newUserInterface.getUserProxy()
newUserInterface.getRecoveryContract()
newUserInterface.setUserProxy("0x2d1d10dca0b19b21c5c862284f966b0d7f43aeea")
Owned.at(newUserInterface.address).contractOwner()

userFactory.setUserRecoveryAddress(recovery.address)

userFactory.userBackendProvider()
userFactory.userRecoveryAddress()
userFactory.oracle()

userFactory.createUserWithProxyAndRecovery(user, recovery.address, false).then(l => console.log(JSON.stringify(l, null, 4)))
userFactory.createUserWithProxyAndRecovery.call(user, recovery.address, false).then(l => console.log(JSON.stringify(l, null, 4)))
newUserInterface.init(oracle, false)
newUserInterface.init.call(oracle, false)


backendProvider.setUserBackend("0x80d616341318416de8866aa26e6a967d2fef058a") // original
backendProvider.setUserBackend("0xc453b05cb819c074686470fd45519f4b529991df")
backendProvider.setUserBackend("0x8ab4463d6da112c4623f3a4306db451f8a408121")
backendProvider.setUserBackend("0x6fc10703877cde68074443ad17d13419f147a058") // temp
backendProvider.setUserBackend(userBackend.address) // temp
backendProvider.getUserBackend()
backendProvider.getUserRegistry()


// Running migration: 2_deploy_contracts.js
//   Running step...
//   ... 0x8e5c62b86cf18699b449127103dbffeb0b4397e5d74b0353ba9fa6739b834b05
//   ... 0x896598991370e15049fc77bef610587079e2fffa56b4eefe73ba27ffd632b7f5
// [StorageManager] address is: 0x4714a31dad1b4bf50811520856a121c4e086d407
//   ... 0x853c4c0c6ed08080e9b42e04c1cfaa6cadf2819ef795bf68ed3f791c2002c9bd
//   ... 0xef06d568bebeed5d9f055b3458c2603aa93b338bd067627c57ac86f8805931c2
// [Storage] address is: 0xb97904bb3df2db88661f9a29f8b84165f9db3046
//   ... 0x239a720e4d993bea70c9f600506e854eb37c4809e845ae8e28520760a4536118
//   ... 0x50126e941782d7b6db890c7080eba3064da4333f794451b87d32d03f0af28742
//   ... 0xa3e047d2a0baef5378e73a6d71ffdfc1fac1081c2ea71157f10c691dde444ee4
//   ... 0x5049cc1ff76487d02463ad2b1c4b8f1f68ca202dfdabaf2a252cd0a1b7712af7
// [Roles2Library] address is: 0x6b79dbd22f7928056fa60b003f01a10a7de94905
//   ... 0x8888cfde3af59a12a3fa5a7d8a2c00a98feb0a62fc5b109c098b5cd91a4f818f
// [Recovery] address is: 0x158a00c831d82e7326a1f741655fc38e8debc3bf
//   ... 0x58a686c3dde8ccc5dc8cce03a92595c41aeeefa52d102c61ee07a2c02074763b
// [UserBackend] address is: 0x3cb9ca3dea45f42455a1d2cf4378f7766c4c9a02
//   ... 0xf8e3e0952625a5c8aca261d4404742e96aef8877035267e14319fd718a8ee0e2
//   ... 0x404392d418bde9b03bf811abd03bb62d9f3ddba1bb7cccd5075274e66b30fb8d
//   ... 0x16d8d7f77f5c22331cc85d31d56fd004fee16bb113a6f14dca85039de26e8cd0
// [UserRegistry] address is: 0x66c8b70f50db4789034cea74b3f6d5ad966df231
//   ... 0xf6e4593226e2276be9daf3a8b8de555b632c35f85b7dd3dba05a2867ab5a359a
//   ... 0xdd5944bc8f1bb245cb9d76fb5e48a57eb348ab790318961277b183e184bff531
//   ... 0x31b4708cd80a9daa25ac84994d6c35442ddcbaaa7ef09f2f409bf5d2d4893ae0
// [UserBackendProvider] address is: 0x87bc110e3e466563df354db83bea3aafdc5ca1ea
//   ... 0xe6b7f53784fbda3276b119fc836ba68f6dff3d6473249bef8d5160ae2e7b6ffc
//   ... 0x0db543526a24613450e36722d075d90ae8e9197ccf028fc34012032eb09f6178
//   ... 0x34e88cd113cd9c82feb9f0cca378da8b1648e80b9e2b8b925db56f751356c289
// [UserFactory] address is: 0x1ee64a06cd50eff93052a37bf2320f6f69d6d50e
//   ... 0x0315bb4c9f21d8e01d5f5fe452ad20e67d03df8b260b163e1fd73cf6d4677e0a


/// RINKEBY

// Running migration: 2_deploy_contracts.js
//   Running step...
//   ... 0xdbd8c6fc69fa605cbe01d91f68fc01ef11e33ecb68916af00757c1f5b1bfc54a
//   ... 0xff46666e1cdf7685f0367d4058a70beff47ac4c546773280e3d7a4a3625c2f80
// [StorageManager] address is: 0x246ec31d095bb5906ba0304f0fbde912e39ee6f6
//   ... 0x74f1c17cb8531649c381d71cf5974ecfc037eb9d7da5133672d20217076af5fd
//   ... 0xb999cc323f9f782bd57389bdebda964a952035a44548cfca681695fdf435f2ba
// [Storage] address is: 0x1e77d9251467d7af341e8ae18725f6dbf4f5f5fc
//   ... 0x1537a73e9fa208cf97c941e28531188a75adf67f2297901ecef706c535de0f15
//   ... 0xbd296ac2bb0420797e3424bc11770cf31633f434cab79a0ed6456193d7561201
//   ... 0x4737288efd1e8442dacd5b873ed77611605a4a34f6f08912f617ebaee36f3fa6
//   ... 0xbbc1da7832ea5cff10eccf82f7d1a3ab9771017da5357aebb9dd75f2faf733d2
// [Roles2Library] address is: 0x62f247e3a971857e11882b9b3bf9486e6baa743e
//   ... 0xfc4399bee9875f974765de4c6e2d8c70c2ecf4c2eb77919a6d90e73906a6f288
// [Recovery] address is: 0x3e3c0c8255c45fa913503211e67835b19273c1ed
//   ... 0xad691c6a673e12eddba3f8a9640d9586a6eba59bedc098504486dc9f627e56f6
// [UserBackend] address is: 0xa54e9eae2370f68044d6f60cd56c2b85ea745e4d
//   ... 0xac8df13e8984940a76e21e258b63e8ce6add8a77ef42f70713754a0d252bf9bf
//   ... 0x8df36d3f0b1cb35ed0e615b8852f4507d17a68dd62c05d4fc594241a1b7c794a
//   ... 0xdc2b3dcc06fe1d4cb8579d7bdbbf7513ceb5599f2ec9bc6a1779449397730811
// [UserRegistry] address is: 0xd6ffe0373475879669b806ea3c476e281f99bf61
//   ... 0x7003e34836d44a99fc00d35f5ee996d2d53a7952c4c2db1fc99fe6f50a40052c
//   ... 0x92016598f83787fc20db399fa37eb1057dda53c7a1f4283bc49f07670cce8ffe
//   ... 0xec64544450337f854d59b33c829a2f75e6bc7004b6ce7d3620a5aef828400fa0
// [UserBackendProvider] address is: 0x6909d8a85af8ea2fe0c3fc69a38981eff2ee8f85
//   ... 0xb71761b662c3dd0dc881fc58b2f83939b07526cf232fe9701bc0f22a69b34a0d
//   ... 0x61a3f10f89c07c6f90adea09ef621bcd3aa6dbf9dce9b0c51692317dae841e04
//   ... 0x68d3431f70feda8d28d04c8bbf6e605ba73a0e6a7f178a7b8bd34a3d0240204e
// [UserFactory] address is: 0x7b6ca266fcad8a37e81808346e6903deca8abe59
//   ... 0xb18217338651cc870d8ef298e6ec235dd141c7de0f83ea0052f076409d723d24


/// PRIVATE

// Running migration: 2_deploy_contracts.js
//   Running step...
//   ... 0xbfc1764cd9a09540837cff0dfc90f75e0b0ca74393f7696d090d3756c34c824e
//   ... 0xaf8ee72736b51a915694b2c7e629849e74e9315aaffc7814652bfed7a4d727d7
// [StorageManager] address is: 0xee9d06c23f79b71adb40f1c2f0f305eb719490fe
//   ... 0x3b77501501ef5fdbcc6237f6f43e27129fd37a68e9ba414f227474e4879826db
//   ... 0x7c8ab7e74b99cbf8787e66aec7e1fcb4a99cc859fc7220e8aaa6c2d94a25f8f6
// [Storage] address is: 0x6841eb7a0e60889aadbc4bfb4f17b068b5dce210
//   ... 0x704a69547bdd642da5e07d36ff34bfb18f44d7aae0898d0425dd1133ce4880c0
//   ... 0xf960ba498d86870db6d638cba6ef5eea6271100adf22c2fe3147c0b776469464
//   ... 0x09f0df7ac80bc881adfad57d3a2df433cd3c130ee3b5f973d41f1e3048c3eb9c
//   ... 0xf94a448f5ebd5833a21871d487d82526b3e5ac9931c8d6cebaf35216c9d12d2a
// [Roles2Library] address is: 0x125841de3cde9bab29616c912118d520726ce241
//   ... 0xb67c4835c48346af470459a8f69223b616f35cf6bae10475e219fc8d1ccafdf1
// [Recovery] address is: 0x6dfb870cf79e0f4a79406d971efbb33895b5d2a8
//   ... 0x274118130220c6dcd09595f0115d1d7010726a00e728935f8b65c5079f1b6eab
// [UserBackend] address is: 0x98bf9f724dab5f5650613edf3cf8db7c0afd9fc4
//   ... 0x4d86f66431e403176408ace635144297faa688985482f96698608dd60c91ba9d
//   ... 0xe18e6e8b9d24f5ffae84c90595caa90e7827df1f12cc82d604adf2acbb48250d
//   ... 0x45acbc4ddfaf236fd6fd41308f1688def909b3586b4e8e92144eddbf52258090
// [UserRegistry] address is: 0xbbfa1e53f76bd68c226e34e0ccfd41e881e5e178
//   ... 0x41bb2fae9660869cf8b933f22e66b4db698cb8ac51db2b74e9c08a315af98867
//   ... 0x317856fb89b140213ffbd08f0ed548ef711f88560b06043205232af0745001a6
//   ... 0x7dd1e1093e73ddf2ec684d44cb618bd5b8983fdf20e2a0ea250aee3fa15d2b85
// [UserBackendProvider] address is: 0xce359f62c017e9387facff1754485c1473227df9
//   ... 0xd0e115eea0f42a8a60e07ca63f78d45ab48d36ef11b807f95fe0c49c2cd795c9
//   ... 0xf805caac0881b62e0993cd99c543647eff5e9cf150c5f0b3d020f2b7d8ba99de
//   ... 0xec6748500d67dd8a6a3328bfa51afbee99aba8de3836d1ffcfac5e0af6678870
// [UserFactory] address is: 0xc84b16057a29e0f0cdbf198f9e67a775db1e159d
//   ... 0xcccd8b9196ddd09b374ef8cacd0d628da2451a52d49a660adf764d5240a36976