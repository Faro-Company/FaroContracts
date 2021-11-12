//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract KTLOToken is ERC20 {
    constructor() ERC20("KTLO Studio Token", "KTLO") {
        _mint(msg.sender, 2440000000 * 10**uint(decimals()));
    }
}
