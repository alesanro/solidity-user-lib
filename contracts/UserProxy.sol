/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.21;


import "solidity-shared-lib/contracts/Owned.sol";


/// @title Defines a proxy contract that could forward calls to another contracts.
/// In user subsystem it is used for holding users accounts and tighly bound with
/// tokens, reputation, accounts. Holds user's balances. Usually monitored and onwed
/// by UserRouter contract which protects from unauthorized calls and provide additional
/// agility in user recovery.
contract UserProxy is Owned {

    event Forwarded (
        address indexed destination,
        uint value,
        bytes data
    );
    event Received (
        address indexed sender,
        uint value
    );

    function () 
    payable
    external 
    {
        emit Received(msg.sender, msg.value);
    }

    /// @notice Forwards invocations to an actual destination
    /// Should only be invoked by contract owner.
    /// Emits Forwarded event.
    /// @param _destination invocation target
    /// @param _data encoded data that will passed to _destination
    /// @param _value amount of Ether passed with call
    /// @param _throwOnFailedCall if true then revert on unsuccessful call, silently fail otherwise
    /// @return first 32 bytes of a call result
    function forward(
        address _destination,
        bytes _data,
        uint _value,
        bool _throwOnFailedCall
    )  
    onlyContractOwner
    public
    returns (bytes32 result) 
    {
        bool success;
        assembly {
            success := call(div(mul(gas, 63), 64), _destination, _value, add(_data, 32), mload(_data), 0, 32)
            result := mload(0)
        }
        require(success || !_throwOnFailedCall, "Throw on failed call in UserProxy");

        emit Forwarded(_destination, _value, _data);
    }
}
