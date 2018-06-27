/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.21;


import "solidity-roles-lib/contracts/Roles2Library.sol";


contract StubRoles2Library is Roles2Library {
    
    constructor(Storage _store, bytes32 _crate) Roles2Library(_store, _crate) public {
    }
}