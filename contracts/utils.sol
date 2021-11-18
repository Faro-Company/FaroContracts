//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract Utils {

    /// @notice usdc address
    /// @notice will be replaced with stable coin
    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    // Send stablecoin.
    function sendStableCoin(address from, address to, uint256 value) external returns (bool){
        // Try to transfer USDC to the given recipient.
        if (!_attemptUSDCTransfer(from, to, value)) {
            return false;
        }
        return true;
    }

    // USDC transfer internal method
    function _attemptUSDCTransfer(address from, address to, uint256 value) internal returns (bool)
    {
        // Here increase the gas limit a reasonable amount above the default, and try
        // to send ETH to the recipient.
        // NOTE: This might allow the recipient to attempt a limited reentrancy attack.
        return IERC20(USDC).transferFrom(from, to, value);
    }

    function getUSDBalance(address source) public view returns(uint256) {
        return IERC20(USDC).balanceOf(source);
    }

}
