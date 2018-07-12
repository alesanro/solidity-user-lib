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


contract UserFactory is Roles2LibraryAdapter, MultiEventsHistoryAdapter {

    uint constant USER_FACTORY_SCOPE = 21000;

    event UserCreated(
        address indexed self,
        address indexed user,
        address proxy,
        address recoveryContract,
        address owner
    );

    address public userBackendProvider;
    address public userRecoveryAddress;
    address public oracle;

    constructor(address _roles2Library) Roles2LibraryAdapter(_roles2Library) public {
        _setEventsHistory(this);
    }

    function setupEventsHistory(address _eventsHistory) 
    auth 
    external 
    returns (uint) 
    {
        require(_eventsHistory != 0x0);
        
        _setEventsHistory(_eventsHistory);
        return OK;
    }

    function setUserBackendProvider(address _newUserBackendProvider)
    auth
    external
    returns (uint)
    {
        require(_newUserBackendProvider != 0x0);

        userBackendProvider = _newUserBackendProvider;
        return OK;
    }

    function setUserRecoveryAddress(address _userRecoveryAddress)
    auth
    external
    returns (uint)
    {
        userRecoveryAddress = _userRecoveryAddress;
        return OK;
    }

    function setOracleAddress(address _oracle)
    auth
    external
    returns (uint)
    {
        require(_oracle != 0x0, "Oracle should not be equal to 0x0");

        oracle = _oracle;
        return OK;
    }

    function createUserWithProxyAndRecovery(
        address _owner,
        bool _use2FA
    )
    public
    returns (uint) 
    {
        UserInterface user = UserInterface(new UserRouter(_owner, userRecoveryAddress, userBackendProvider));
        user.init(oracle, _use2FA);

        _addUserToRegistry(address(user));

        address proxy = user.getUserProxy();
        UserFactory(getEventsHistory()).emitUserCreated(
            user,
            proxy,
            userRecoveryAddress,
            _owner
        );
        return OK;
    }

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
