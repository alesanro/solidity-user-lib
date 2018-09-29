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
    uint constant TX_INPUT_ZERO_BYTES_PRICE = 4;
    uint constant TX_INPUT_NONZERO_BYTES_PRICE = 68;
    uint constant TX_DEFAULT_PRICE = 21000;
    uint constant BYTES_WORD_SIZE = 32; // 256 bits

    uint constant ESTIMATION_CALCULATION_GAS = 51;

    modifier estimateCashbackAndPay(uint _calldataPrefixLength, uint _onlyStartFunctionGas) {
        uint _gasBefore = gasleft();

        _;

        if (!_shouldPayCashback()) {
            return;
        }

        uint _beforeStartCashbackGasEstimation = _getBeforeExecutionGasEstimation(_onlyStartFunctionGas);
        uint _constantGas = _getConstantGas(_calldataPrefixLength);
        uint _gasAfterwards = gasleft();
        uint _totalGasSpent = _constantGas + _beforeStartCashbackGasEstimation + (_gasBefore - _gasAfterwards);
        uint _debt = _totalGasSpent * tx.gasprice;
    
        _transferCashback(_debt);
    }

    function _estimateCalldatacopyGas() internal pure returns (uint _result) {
        uint _calldatasize;
        assembly {
            _calldatasize := calldatasize
        }
        
         // G_MEMORY used here as memory expansion coefficient; must be quadratic after 724B memory
        _result = G_VERYLOW + G_COPY * G_MEMORY * _calldatasize / BYTES_WORD_SIZE;
    }

    event LogEstimated(uint _calldatasize, uint _result);
    
    function _estimateTxInputDataGas(uint _calldataPrefixLength) private returns (uint _result) {
        uint _calldatasize;
        assembly {
            _calldatasize := calldatasize
        }
        
        /*
        We put here a lot of investigations and experiments here for the result where
        total gas fee payed for passed transaction input data will be calculated
        as expensive as possible for non-zero bytes and takes 68 for each non-zero byte.
        That takes less gas than calculating number of zero and non-zero bytes by smart
        contract itself or using approximate ratio between zero and non-zero
        number of bytes.

        According to experiments and getting data that depends only on input data we have the next:
        WolframAlpha http://www.wolframalpha.com/input/?i=linear++%7B%7B640,+9909%7D,+%7B772,+10898%7D,+%7B1156,+13868%7D,+%7B548,+9167%7D,+%7B292,+7188%7D,+%7B132,+5969%7D,+%7B228,+6694%7D,+%7B68,+5475%7D%7D
        */
        _result = (772 * (_calldatasize - _calldataPrefixLength)) / 100 + 4944;

        emit LogEstimated(_calldatasize, _result);
    }
    
    function _getConstantGas(uint _calldataPrefixLength) private returns (uint) {
        return TX_DEFAULT_PRICE + _estimateTxInputDataGas(_calldataPrefixLength) + ESTIMATION_CALCULATION_GAS + _getTransferCashbackEstimation();
    }

    function _shouldPayCashback() internal view returns (bool);
    function _getBeforeExecutionGasEstimation(uint _beforeFunctionEstimation) internal view returns (uint);
    function _getTransferCashbackEstimation() internal pure returns (uint);
    function _transferCashback(uint _cashbackValue) internal;
}
