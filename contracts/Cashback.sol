/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


/// @title TODO:
/// @dev Any contract that inherits from Cashback should implement _getTransferCashbackEstimation and
///		_transferCashback functions to fully cover all predefined gas estimations
contract Cashback {

    uint constant G_MEMORY = 3;
    uint constant G_COPY = 3;
    uint constant G_VERYLOW = 3;
    uint constant BYTES_WORD_SIZE = 32; // 256 bits

    uint constant TX_INPUT_ZERO_BYTES_PRICE = 4;
    uint constant TX_INPUT_NONZERO_BYTES_PRICE = 68;
    uint constant TX_DEFAULT_PRICE = 21000;

    uint constant ESTIMATION_CALCULATION_GAS = 87;
    uint constant MAX_ANALYZED_CALLDATASIZE = 68; // 2 words

    uint constant ETHEREUM_STORAGE_OVERWRITE_GAS_REFUND = 15000;

    modifier estimateCashbackAndPay(
        uint _calldataPrefixLength, 
        uint _onlyStartFunctionGas, 
        uint _allowedUserGroups, 
        bool _useCalldatacopy
    ) {
        uint _gasBefore = gasleft();

        address _wallet = _getWallet();
        address _cashbackRecepient = msg.sender;
        if (!_shouldPayCashback(_allowedUserGroups)) {
            _;
            return;
        }

        _;

        uint _debt = _finalizeCashbackEstimations(_gasBefore, _calldataPrefixLength, _onlyStartFunctionGas, _useCalldatacopy);
        _transferCashback(_wallet, _debt, _cashbackRecepient);
    }

    modifier bindCashbackPresets(
        bytes32[5] memory _presets, 
        uint _calldataPrefixLength, 
        uint _onlyStartFunctionGas, 
        uint _allowedUserGroups) 
    {
        _presets[0] = bytes32(gasleft());
        _presets[1] = bytes32(_getWallet());
        _presets[2] = bytes32(_calldataPrefixLength);
        _presets[3] = bytes32(_onlyStartFunctionGas);
        _presets[4] = bytes32(_allowedUserGroups);
        _;
    }

    function _estimateCashbackAndPay(bytes32[5] memory _presets, bool _useCalldatacopy) internal {
        if (!_shouldPayCashback(uint(_presets[4]))) {
            return;
        }

        address _cashbackRecepient = msg.sender;
        uint _debt = _finalizeCashbackEstimations(uint(_presets[0]), uint(_presets[2]), uint(_presets[3]), _useCalldatacopy);
        _transferCashback(address(_presets[1]), _debt, _cashbackRecepient);
    }

    function _finalizeCashbackEstimations(
        uint _gasBefore, 
        uint _calldataPrefixLength, 
        uint _onlyStartFunctionGas, 
        bool _useCalldatacopy
    ) 
    private 
    returns (uint _debt) 
    {
        uint _beforeStartCashbackGasEstimation = _getBeforeExecutionGasEstimation(_onlyStartFunctionGas);
        // '2' - cause we have 2 calls before estimation starts: to router and to user backend
        _beforeStartCashbackGasEstimation += _useCalldatacopy ? (2 * _estimateCalldatacopyGas()) : 0;
        uint _refund = _getOperationsRefund();
        if (_refund > 0) {
            _nullifyOperationsRefund();
            _refund += ETHEREUM_STORAGE_OVERWRITE_GAS_REFUND; // for nullifying the refund
        }

        uint _constantGas = _getConstantGas(_calldataPrefixLength);
        uint _gasAfterwards = _refund + gasleft();
        uint _totalGasSpent = _constantGas + _beforeStartCashbackGasEstimation + (_gasBefore - _gasAfterwards);

        _debt = _totalGasSpent * tx.gasprice;
    }

    function _estimateCalldatacopyGas() internal pure returns (uint _result) {
        uint _calldatasize;
        assembly {
            _calldatasize := calldatasize
        }
        
        // G_MEMORY used here as memory expansion coefficient; must be quadratic after 724B memory
        _result = G_VERYLOW + G_COPY * G_MEMORY * _calldatasize / BYTES_WORD_SIZE;
    }

    function _estimateTxInputDataGas(uint _calldataPrefixLength) private pure returns (uint _result) {
        uint _calldatasize;
        assembly {
            _calldatasize := calldatasize
        }
        
        _calldatasize = _calldatasize - _calldataPrefixLength;

        /*
        We put here a lot of investigations and experiments here for the result where
        total gas fee payed for passed transaction input data will be calculated
        as expensive as possible for non-zero bytes and takes 68 for each non-zero byte.
        That takes less gas than calculating number of zero and non-zero bytes by smart
        contract itself or using approximate ratio between zero and non-zero
        number of bytes.        
        */
        uint nonZeroBytesCount = 0;
        if (_calldatasize <= MAX_ANALYZED_CALLDATASIZE) {
            for (uint _byteIdx = _calldataPrefixLength; _byteIdx < msg.data.length; ++_byteIdx) {
                if (msg.data[_byteIdx] != byte(0)) {
                    nonZeroBytesCount += 1;
                }
            }

            _result = nonZeroBytesCount * TX_INPUT_NONZERO_BYTES_PRICE + (_calldatasize - nonZeroBytesCount) * TX_INPUT_ZERO_BYTES_PRICE;
        }
        else {
            _result = _calldatasize * TX_INPUT_NONZERO_BYTES_PRICE;
            /*
            Wolfram notes
            https://www.wolframalpha.com/input/?i=linear+fit+%7B%7B228,+8216%7D,+%7B612,+12267%7D,+%7B260,+9636%7D,+%7B324,+10044%7D,+%7B740,+17883%7D,+%7B1348,+30276%7D,+%7B964,+15600%7D%7D

            Using this approach is more effective and cost less than full input data size cost coverage: 
            it will provide less overpayment and other huge transactions will be covered by taking those overpaid cryptocurrency
            */
            // _result = (1955 * _calldatasize) / 100 + 3823;
            nonZeroBytesCount = ((35 * _calldatasize) / 100);
            _result = nonZeroBytesCount * TX_INPUT_NONZERO_BYTES_PRICE + (_calldatasize - nonZeroBytesCount) * TX_INPUT_ZERO_BYTES_PRICE;
        }
    }
    
    function _getConstantGas(uint _calldataPrefixLength) private pure returns (uint) {
        return TX_DEFAULT_PRICE + _estimateTxInputDataGas(_calldataPrefixLength) + ESTIMATION_CALCULATION_GAS + _getTransferCashbackEstimation();
    }

    function _shouldPayCashback(uint _allowedUserGroups) internal view returns (bool);
    function _getBeforeExecutionGasEstimation(uint _beforeFunctionEstimation) internal view returns (uint);
    function _getTransferCashbackEstimation() internal pure returns (uint);
    function _transferCashback(address _from, uint _cashbackValue, address _to) internal;
    
    function _getOperationsRefund() internal view returns (uint);
    function _nullifyOperationsRefund() internal;

    function _getWallet() internal view returns (address);
}
