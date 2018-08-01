# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

<a name="0.2.0"></a>
# 0.2.0 (2018-08-01)

## Features:

* **multisig**: LABX-377 Add ability to cancel tx on revoke when number of confirmations becomes nil. ([b36eee5](https://github.com/alesanro/solidity-user-lib/commit/b36eee5))
* **userinterface**: LABX-375 Contract: add User2FAChanged event; update tests ([858ba14](https://github.com/alesanro/solidity-user-lib/commit/858ba14))
* **utility**: LABX-371 Add utility method to check if UserProxy is managed by an account ([65f6474](https://github.com/alesanro/solidity-user-lib/commit/65f6474))
* **userinterface** LABX-359 Add immediate forward with signed transaction for 2FA protection ([ed7f662](https://github.com/alesanro/solidity-user-lib/commit/ed7f662))

## Project:

* **package.json** LABX-359 Update package.json: set definite accounts for testrpc; add web3 utilities ([2f59bd5](https://github.com/alesanro/solidity-user-lib/commit/2f59bd5))

### BREAKING CHANGES

* update signature for MultiSig getters, add statuses instead of boolean 'executed'



<a name="0.1.0"></a>
# 0.1.0 (2018-07-17)
- add user-based contracts;
- use linters (eslint and solium);
- cover smart contract with tests;
- add migration templates.
