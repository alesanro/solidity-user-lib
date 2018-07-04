/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.21;


import "solidity-roles-lib/contracts/Roles2LibraryAdapter.sol";
import "solidity-shared-lib/contracts/Owned.sol";
import "./UserRouter.sol";
import "./UserProxy.sol";
import "./UserBackend.sol";
import "./UserInterface.sol";


contract UserFactory is Roles2LibraryAdapter {

    uint constant USER_FACTORY_SCOPE = 21000;
    uint constant USER_FACTORY_INVALID_BACKEND_VERSION = 21001;

    event UserCreated(
        address indexed self,
        address indexed user,
        address proxy,
        address recoveryContract,
        address owner
    );

    address public userBackend;
    address public oracle;
    address public eventsHistory;

    constructor(address _roles2Library) Roles2LibraryAdapter(_roles2Library) public {
        eventsHistory = this;
    }

    function getEventsHistory() public view returns (address) {
        return eventsHistory;
    }

    function setupEventsHistory(address _eventsHistory) auth external returns (uint) {
        require(_eventsHistory != 0x0);

        eventsHistory = _eventsHistory;
        return OK;
    }

    function setUserBackend(address _newUserBackend)
    auth
    external
    returns (uint)
    {
        require(_newUserBackend != 0x0);

        userBackend = _newUserBackend;
        return OK;
    }

    function setOracleAddress(address _oracle)
    auth
    external
    returns (uint)
    {
        require(_oracle != 0x0);

        oracle = _oracle;
        return OK;
    }

    function createUserWithProxyAndRecovery(
        address _owner,
        address _recoveryContract,
        bool _use2FA
    )
    public
    returns (uint) 
    {
        require(_owner != 0x0, "Owner should not be equal to 0x0");

        UserInterface user = UserInterface(address(new UserRouter(address(this), _recoveryContract, userBackend)));
        user.init(oracle);
        if (_use2FA) {
            assert(OK == user.set2FA(_use2FA));
        }

        assert(Owned(user).transferOwnership(_owner));

        address proxy = user.getUserProxy();
        UserFactory(getEventsHistory()).emitUserCreated(
            user,
            proxy,
            _recoveryContract,
            _owner
        );
        return OK;
    }

    function updateBackendForUser(UserInterface _user) 
    auth
    external
    returns (uint) {
        UserBackend _newUserBackend = UserBackend(userBackend);
        UserBackend _oldUserBackend = UserBackend(UserBase(address(_user)).backend());

        if (_newUserBackend.version() == _oldUserBackend.version()) {
            return USER_FACTORY_INVALID_BACKEND_VERSION;
        }

        return _user.updateBackend(address(_newUserBackend));
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
}
