//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FaroToken is ERC20 {

    constructor() ERC20("Faro Studio Token", "FARO") {
        _mint(msg.sender, 244000000 * 10**uint(decimals()));
    }

    function balancesOf(address[] holders) public view returns (uint[]) {
        require(holders.length < 100, "Max number of balances to be retrieved is 100");
        address[] memory result = new address[](holders.length);
        for (uint i = 0; i < holders.length; i++) {
            result[i] = this.balanceOf(holders[i]);
        }
        return result;
    }
}
