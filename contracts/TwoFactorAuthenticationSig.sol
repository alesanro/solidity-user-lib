/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.21;


import "./MultiSig.sol";


/// @title Intermediat contract that organizes two-factor authentication based on
/// MultiSig smart contract. Contract should be initialized (_init() function called)
/// before using any multisig-protected operations. It assumes that oracle will be stored
/// as the second owner (at index 1).
contract TwoFactorAuthenticationSig is MultiSig {

    uint constant TWO_FACTOR_RESERVED_OWNERS_LENGTH = 2;

    function _init(address _initiator, address _oracle)
    internal
    {
        uint _required = TWO_FACTOR_RESERVED_OWNERS_LENGTH;
        address[] memory _owners = new address[](_required);
        _owners[0] = _initiator;
        _owners[1] = _oracle;
        MultiSig._initMultiSig(_owners, _required);
    }

    function _setOracle(address _oracle)
    internal
    {
        require(_oracle != 0x0, "Oracle should not be equal to 0x0");
        
        this.replaceOwner(owners[1], _oracle);
    }

    /// @notice Gets oracle address that is used to confirm txs.
    /// @return address of an oracle
    function getOracle()
    public
    view
    returns (address) 
    {
        return owners[1];
    }
}