//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract Utils {

    /// @notice usdc address
    /// @notice uncomment the one above for changing
    //IERC20 public constant USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    IERC20 public constant USDC = IERC20(0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e);

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
        return USDC.transferFrom(from, to, value);
    }

    function getUSDBalance(address source) public view returns(uint256) {
        return USDC.balanceOf(source);
    }
}
