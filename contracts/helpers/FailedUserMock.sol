/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.18;


contract FailedUserMock {

    uint constant USER_ERROR = 19001;

    address public contractOwner;
    uint public recoverUserCalls;

    function recoverUser(address) external returns (uint) {
        recoverUserCalls++;
        return USER_ERROR;
    }

    function setContractOwner(address _newOwner) external returns (bool) {
        contractOwner = _newOwner;
        return true;
    }

}
