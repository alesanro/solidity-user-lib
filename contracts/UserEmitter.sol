/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.21;


contract UserEmitter {

    event User2FAChanged(address indexed self, address indexed initiator, address user, address indexed proxy, bool enabled);

    function emitUser2FAChanged(address _initiator, address _user, address _proxy, bool _enabled) public {
        emit User2FAChanged(msg.sender, _initiator, _user, _proxy, _enabled);
    }
}