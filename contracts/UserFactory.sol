/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.21;


import "solidity-shared-lib/contracts/Owned.sol";
import "solidity-eventshistory-lib/contracts/MultiEventsHistoryAdapter.sol";
import "solidity-roles-lib/contracts/Roles2LibraryAdapter.sol";
import "./UserRouter.sol";
import "./UserBackendProviderInterface.sol";
import "./UserRegistry.sol";
import "./UserInterface.sol";


/// @title Creates new users for a system and registers them in UserRegistry contract.
contract UserFactory is Roles2LibraryAdapter, MultiEventsHistoryAdapter {

    uint constant USER_FACTORY_SCOPE = 21000;

    event UserCreated(
        address indexed self,
        address indexed user,
        address proxy,
        address recoveryContract,
        address indexed owner
    );

    address public userBackendProvider;
    address public userRecoveryAddress;
    address public oracle;

    constructor(address _roles2Library) Roles2LibraryAdapter(_roles2Library) public {
        _setEventsHistory(this);
    }

    /// @notice Sets up events history address
    /// Allowed only for authorized roles
    /// @param _eventsHistory address of events history contract
    /// @return result of an operation
    function setupEventsHistory(address _eventsHistory) 
    auth 
    external 
    returns (uint) 
    {
        require(_eventsHistory != 0x0);
        
        _setEventsHistory(_eventsHistory);
        return OK;
    }

    /// @notice Sets up user backend provider address
    /// Allowed only for authorized roles
    /// @param _newUserBackendProvider address of user backend provider contract
    /// @return result of an operation
    function setUserBackendProvider(address _newUserBackendProvider)
    auth
    external
    returns (uint)
    {
        require(_newUserBackendProvider != 0x0);

        userBackendProvider = _newUserBackendProvider;
        return OK;
    }

    /// @notice Sets up user recovery address address
    /// Allowed only for authorized roles
    /// @param _userRecoveryAddress address of user recovery contract
    /// @return result of an operation
    function setUserRecoveryAddress(address _userRecoveryAddress)
    auth
    external
    returns (uint)
    {
        userRecoveryAddress = _userRecoveryAddress;
        return OK;
    }

    /// @notice Sets up 2FA oracle address
    /// Allowed only for authorized roles
    /// @param _oracle address of 2FA oracle
    /// @return result of an operation
    function setOracleAddress(address _oracle)
    auth
    external
    returns (uint)
    {
        require(_oracle != 0x0, "Oracle should not be equal to 0x0");

        oracle = _oracle;
        return OK;
    }

    /// @notice Creates brand new user in a system with passed owner and
    /// could setup default mode of 2FA.
    /// Allowed for any caller.
    /// Emits UserCreated event.
    /// @param _owner address of an owner of a user
    /// @param _use2FA if true then 2FA will be enabled
    /// @return result of an operation
    function createUserWithProxyAndRecovery(
        address _owner,
        bool _use2FA,
        address[] _thirdparties
    )
    public
    payable
    returns (uint) 
    {
        UserInterface user = UserInterface(new UserRouter(_owner, userRecoveryAddress, userBackendProvider));
        user.init(oracle, _use2FA, _thirdparties);

        _addUserToRegistry(address(user));

        address proxy = user.getUserProxy();
        proxy.transfer(msg.value);
        UserFactory(getEventsHistory()).emitUserCreated(
            user,
            proxy,
            userRecoveryAddress,
            _owner
        );
        return OK;
    }

    /// @notice Sets up new backend provider for a user
    /// Allowed only for authorized roles
    /// @param _user user that wants to have a new version of backend provider
    /// @return result of an operation
    function updateBackendProviderForUser(UserInterface _user) 
    auth
    external
    returns (uint) 
    {
        return _user.updateBackendProvider(userBackendProvider);
    }

    function emitUserCreated(
        address _user,
        address _proxy,
        address _recoveryContract,
        address _owner
    ) 
    external 
    {
        emit UserCreated(
            msg.sender,
            _user,
            _proxy,
            _recoveryContract,
            _owner
        );
    }

    /* INTERNAL */

    function _getUserRegistry() private view returns (UserRegistry) {
        return UserRegistry(UserBackendProviderInterface(userBackendProvider).getUserRegistry());
    }

    function _addUserToRegistry(address _user) private {
        UserRegistry _userRegistry = _getUserRegistry();
        if (address(_userRegistry) != 0x0) {
            _userRegistry.addUserContract(_user);
        }
    }
}
