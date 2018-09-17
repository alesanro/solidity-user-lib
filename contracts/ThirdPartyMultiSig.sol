/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.21;


import "./TwoFactorAuthenticationSig.sol";


/// @title Intermediate contract that organizes access to 3rd party remote addresses that
/// have equal rights for signing functions but key functionality still requires an owner.
contract ThirdPartyMultiSig is TwoFactorAuthenticationSig {

    function confirmTransaction(uint transactionId)
    public
    {   
        _assertConfirmationConsistency(transactionId, msg.sender);

        super.confirmTransaction(transactionId);
    }

    function confirmTransactionWithVRS(uint transactionId, bytes pass, uint8 v, bytes32 r, bytes32 s)
    public
    {
        bytes32 _message = getMessageForTransaction(transactionId, pass);
        address _signer = getSigner(_message, v, r, s);
        _assertConfirmationConsistency(transactionId, _signer);

        super.confirmTransactionWithVRS(transactionId, pass, v, r, s);
    }

    /// @notice Checks if an address `_address` is one of 3rd party owners (origin owner is not included)
    /// @param _address account address to check
    function isThirdPartyOwner(address _address) 
    public 
    view 
    returns (bool) 
    {
        return isOwner[_address] && !(_address == getOwner() || _address == getOracle());
    }

    /// @notice Gets a list of 3rd party owners (if such exist).
    function getThirdPartyOwners()
    public
    view 
    returns (address[] _owners)
    {
        if (owners.length <= TWO_FACTOR_RESERVED_OWNERS_LENGTH) {
            return;
        }

        _owners = new address[](owners.length - TWO_FACTOR_RESERVED_OWNERS_LENGTH);
        uint _pointer = 0;
        for (uint _ownerIdx = TWO_FACTOR_RESERVED_OWNERS_LENGTH; _ownerIdx < owners.length; ++_ownerIdx) {
            _owners[_pointer++] = owners[_ownerIdx];
        }
    }

    function _addThirdPartyOwner(address _owner) 
    internal 
    returns (uint) 
    {
        this.addOwner(_owner);
    }

    function _revokeThirdPartyOwner(address _owner)
    internal
    {
        require(isThirdPartyOwner(_owner), "THIRD_PARTY_MULTISIG_SHOULD_NOT_BE_OWNER_OR_ORACLE_ADDRESS");
        this.removeOwner(_owner);
    }

    /* PRIVATE */

    function _assertConfirmationConsistency(uint transactionId, address sender) private view {
        uint _confirmationsCount = getConfirmationCount(transactionId);
        // Prevents from being confirmed by owner and 3rd party service at once (only one of them is allowed to confirm tx)
        if (_confirmationsCount > 0 &&
            ((confirmations[transactionId][getOwner()] && sender != getOracle()) ||
            (!confirmations[transactionId][getOracle()] && sender == getOwner()))
        ) {
            revert("THIRD_PARTY_MULTISIG_INVALID_CONFIRMATION");
        }
    }
}