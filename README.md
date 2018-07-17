# User smart contracts library [![Build Status](https://travis-ci.org/ChronoBank/solidity-user-lib.svg?branch=master)](https://travis-ci.org/ChronoBank/solidity-user-lib)

Part of [LaborX project](https://github.com/ChronoBank). Provides a set of smart contracts to organize an environment with users and 2FA access

- **UserRegistry** - keeps track of created users in a system;
- **UserBackendProvider** - contract that provides services in a centralized way;
- **UserFactory** - creates users (UserRouter contract) with defined parameters and registers them in UserRegistry;
- **Recovery** - base contract for centralized user recovery;
- **UserBackend** - user shared library contract that is used to move all the logic into separate contract;
- **UserRouter** - user facade contract; all the time a user interacts exactly with UserRouter contract; see UserInterface contract;
- **UserInterface** - interface of a user contract; use `UserInterface.at(userRouter.address)` to perform calls.

## Installation

Organized as npm package this smart contracts could be easily added to a project by

```bash
npm install -s solidity-user-lib
```

## Usage

Right before you decided to use them add this library to package dependencies and import any contract according to this pattern, for example:

```javascript
import "solidity-shared-lib/contracts/UserFactory.sol";
```

or

```javascript
import "solidity-shared-lib/contracts/UserBackendProvider.sol";
```

Cause you might want to use **UserFactory** or other contracts without any changes (if you want to then skip this paragraph), you will need to deploy this contract. But due to imperfection of **truffle** framework when you write in migration files `const UserFactory = artifacts.require("UserFactory")` this artifact will not be found. You have two options:
1. Inherit from _UserFactory_ and **truffle** will automatically grap contract's artifact;
2. Create a solidity file, for example, **Imports.sol** and add an `import` statement of _UserFactory_ and all other contracts that you need. (I would recommend this one because it will not produce one more contract name and looks more reasonable.)

## Details

### Prerequisites

Before any steps of deploying and using user contract first you need to prepare **Storage**, **StorageManager**, **Roles2Library** contracts (or get them if they were previously set up).

## Migrations

Migration templates are presented in `./migrations_templates` folder so you can use them as a scaffolding for your own configuration. Basic scenarios covered by migration templates are:

- deploying _UserBackend_ contract;
- deploying _UserRegistry_ contract;
- deploying _UserBackendProvider_ contract and setup backend and registry contracts;
- deploying _Recovery_ contract;
- deploying and initializing _UserFactory_ contract; setup access rights for making records into UserRegistry

---

For more information and use cases look at tests.