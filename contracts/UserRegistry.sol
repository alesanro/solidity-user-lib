/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.23;


import "solidity-storage-lib/contracts/StorageAdapter.sol";
import "solidity-roles-lib/contracts/Roles2LibraryAdapter.sol";
import "solidity-eventshistory-lib/contracts/MultiEventsHistoryAdapter.sol";
import "./UserOwnershipListenerInterface.sol";


/// @title Acts like a registry for existed users across a system.
/// Upgradable (thanks to Storage contract), protected by roles access.
/// Allows to keep records about who owns which contracts and update these records
/// accordingly. Contracts should use UserOwnershipListenerInterface to sign about
/// ownership changes and if this contract was added to the registry then the record
/// will be updated, otherwise nothing happen.
contract UserRegistry is StorageAdapter, Roles2LibraryAdapter, MultiEventsHistoryAdapter, UserOwnershipListenerInterface {

    uint constant USER_REGISTRY_SCOPE = 30000;
    uint constant USER_REGISTRY_USER_CONTRACT_ALREADY_EXISTS = USER_REGISTRY_SCOPE + 1;
    uint constant USER_REGISTRY_NO_USER_CONTRACT_FOUND = USER_REGISTRY_SCOPE + 2;
    uint constant USER_REGISTRY_CANNOT_CHANGE_TO_THE_SAME_OWNER = USER_REGISTRY_SCOPE + 3;

    event UserContractAdded(address indexed self, address indexed userContract, address indexed owner);
    event UserContractRemoved(address indexed self, address indexed userContract, address indexed owner);
    event UserContractChanged(address indexed self, address indexed userContract, address oldOwner, address indexed owner);

    /// @dev mapping(owner => (set of user's contracts)
    StorageInterface.AddressesSetMapping internal ownedUsersStorage;

    constructor(Storage _store, bytes32 _crate, address _roles2Library)
    StorageAdapter(_store, _crate)
    Roles2LibraryAdapter(_roles2Library)
    public 
    {
        ownedUsersStorage.init("ownedUsersStorage");
    }

    /// @notice Sets up events history address
    /// Allowed only for authorized roles.
    /// @param _eventsHistory address of events history contract
    /// @return result of an operation
    function setupEventsHistory(address _eventsHistory) 
    external 
    auth 
    returns (uint) 
    {
        require(_eventsHistory != 0x0);
        
        _setEventsHistory(_eventsHistory);
        return OK;
    }

    /// @notice Gets a list of contracts that are associated with provided user
    /// @param _account user address to seek
    /// @return array of contracts owned by a user
    function getUserContracts(address _account)
    public
    view
    returns (address[] _users)
    {
        _users = store.get(ownedUsersStorage, bytes32(_account));
    }

    /// @notice Registers a contract and associate it with its owner. Contract passed
    /// here should be compatible with Owned contract interface.
    /// Allowed only for authorized roles.
    /// Emits UserContractAdded event.
    /// @param _contract contract address to register; should support Owned interface
    /// @return result of an operation
    function addUserContract(address _contract)
    external
    auth
    returns (uint)
    {
        address _owner = Owned(_contract).contractOwner();
        if (!_addUserContract(_contract, _owner)) {
            return _emitErrorCode(USER_REGISTRY_USER_CONTRACT_ALREADY_EXISTS);
        }
        
        _emitter().emitUserContractAdded(_contract, _owner);
        return OK;
    }

    /// @notice Removes a contract from provided user association. 
    /// Mostly used to clean up unrelevant connections.
    /// Allowed only for authorized roles.
    /// Emits UserContractRemoved event.
    /// @param _contract contract address to remove
    /// @return result of an operation
    function removeUserContractFrom(address _contract, address _from)
    external
    auth
    returns (uint)
    {
        if (!_removeUserContract(_contract, _from)) {
            return _emitErrorCode(USER_REGISTRY_NO_USER_CONTRACT_FOUND);
        }

        _emitter().emitUserContractRemoved(_contract, _from);
        return OK;
    }

    /// @notice Removes a contract from msg.sender association.
    /// Not protected by a role auth, so any user who has record with
    /// his contract could remove his contracts.
    /// @param _contract contract address to remove
    /// @return result of an operation
    function removeUserContract(address _contract)
    external
    returns (uint)
    {
        return this.removeUserContractFrom(_contract, msg.sender);
    }

    /// @notice Listener function. Updates records when contract owner changed
    /// in a stored contract. Does not allow to add a contract record through this function.
    /// Emits UserContractChanged event.
    /// @param _contract contract address that have a new owner
    /// @param _from old contract owner address
    function userOwnershipChanged(address _contract, address _from) 
    external
    {
        address _owner = Owned(_contract).contractOwner();
        if (_owner == _from) {
            _emitErrorCode(USER_REGISTRY_CANNOT_CHANGE_TO_THE_SAME_OWNER);
            return;
        }

        if (!_removeUserContract(_contract, _from)) {
            _emitErrorCode(USER_REGISTRY_NO_USER_CONTRACT_FOUND);
            return;
        }

        if (_addUserContract(_contract, _owner)) {
            _emitter().emitUserContractChanged(_contract, _from, _owner);
        } else {
            _emitter().emitUserContractRemoved(_contract, _from);
        }
    }

    /* EVENTS EMITTING (for events history) */

    function emitUserContractAdded(address _contract, address _owner) external {
        emit UserContractAdded(_self(), _contract, _owner);
    }

    function emitUserContractRemoved(address _contract, address _owner) external {
        emit UserContractRemoved(_self(), _contract, _owner);
    }

    function emitUserContractChanged(address _contract, address _oldOwner, address _owner) external {
        emit UserContractChanged(_self(), _contract, _oldOwner, _owner);
    }

    /* INTERNAL */

    function _addUserContract(address _contract, address _owner) private returns (bool) {
        if (!store.includes(ownedUsersStorage, bytes32(_owner), _contract)) {
            store.add(ownedUsersStorage, bytes32(_owner), _contract);
            return true;
        }
    }

    function _removeUserContract(address _contract, address _from) private returns (bool) {
        if (store.includes(ownedUsersStorage, bytes32(_from), _contract)) {
            store.remove(ownedUsersStorage, bytes32(_from), _contract);
            return true;
        }
    }

    function _emitter() private view returns (UserRegistry) {
        return UserRegistry(getEventsHistory());
    }
}