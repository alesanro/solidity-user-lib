/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.21;


import "../UserBackend.sol";


contract BumpedUserBackend is UserBackend {

    event BumpedUserBackendEvent();

    bytes32 public version = "2.0.1";

    function forward(
        address _destination,
        bytes _data,
        uint _value,
        bool _throwOnFailedCall
    )
    public
    returns (bytes32) 
    {
        emit BumpedUserBackendEvent();
        return super.forward(_destination, _data, _value, _throwOnFailedCall);
    }
}