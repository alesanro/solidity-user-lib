/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


/// @title TODO:
/// @dev Any contract that inherits from Cashback should implement _getTransferCashbackEstimation and
///		_transferCashback functions to fully cover all predefined gas estimations
contract Cashback {

    uint constant TX_INPUT_ZERO_BYTES_PRICE = 4;
    uint constant TX_INPUT_NONZERO_BYTES_PRICE = 68;
    uint constant TX_DEFAULT_PRICE = 21000;

    uint constant ESTIMATION_CALCULATION_GAS = 70;
    uint constant MAX_ANALYZED_CALLDATASIZE = 68; // 2 words

    uint constant ETHEREUM_STORAGE_OVERWRITE_GAS_REFUND = 15000;

    event LogGas(uint _gas, bytes _data);
    modifier estimateCashbackAndPay(uint _calldataPrefixLength, uint _onlyStartFunctionGas) {
        uint _gasBefore = gasleft();
        address _wallet = _getWallet();
        address _cashbackRecepient = msg.sender;
        if (!_shouldPayCashback()) {
            _;
            return;
        }

        _;

        uint _beforeStartCashbackGasEstimation = _getBeforeExecutionGasEstimation(_onlyStartFunctionGas);
        uint _refund = _getOperationsRefund();
        if (_refund > 0) {
            _nullifyOperationsRefund();
            _refund += ETHEREUM_STORAGE_OVERWRITE_GAS_REFUND; // for nullifying the refund
        }
        uint _constantGas = _getConstantGas(_calldataPrefixLength);
        uint _gasAfterwards = _refund + gasleft();
        uint _totalGasSpent = _constantGas + _beforeStartCashbackGasEstimation + (_gasBefore - _gasAfterwards);
        uint _debt = _totalGasSpent * tx.gasprice;

        _transferCashback(_wallet, _debt, _cashbackRecepient);
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
        if (_calldatasize <= MAX_ANALYZED_CALLDATASIZE) {
            uint nonZeroBytesCount = 0;
            for (uint _byteIdx = _calldataPrefixLength; _byteIdx < msg.data.length; ++_byteIdx) {
                if (msg.data[_byteIdx] != byte(0)) {
                    nonZeroBytesCount += 1;
                }
            }

            _result = nonZeroBytesCount * TX_INPUT_NONZERO_BYTES_PRICE + (_calldatasize - nonZeroBytesCount) * TX_INPUT_ZERO_BYTES_PRICE;
        }
        else {
            _result = _calldatasize * TX_INPUT_NONZERO_BYTES_PRICE;
        }
    }
    
    function _getConstantGas(uint _calldataPrefixLength) private pure returns (uint) {
        return TX_DEFAULT_PRICE + _estimateTxInputDataGas(_calldataPrefixLength) + ESTIMATION_CALCULATION_GAS + _getTransferCashbackEstimation();
    }

    function _shouldPayCashback() internal view returns (bool);
    function _getBeforeExecutionGasEstimation(uint _beforeFunctionEstimation) internal view returns (uint);
    function _getTransferCashbackEstimation() internal pure returns (uint);
    function _transferCashback(address _from, uint _cashbackValue, address _to) internal;
    
    function _getOperationsRefund() internal view returns (uint);
    function _nullifyOperationsRefund() internal;

    function _getWallet() internal view returns (address);
}
