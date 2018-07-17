/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.18;


contract UserMock {

    uint constant OK = 1;

    address public contractOwner;
    uint public recoverUserCalls;

    function recoverUser(address _newAddress) external returns (uint) {
        contractOwner = _newAddress;
        recoverUserCalls++;
        return OK;
    }

    function setContractOwner(address _newOwner) external returns (bool) {
        contractOwner = _newOwner;
        return true;
    }

}
