//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

contract KTLOFractional is ERC20Upgradeable{

    constructor(string memory _name, string memory _symbol, uint256 _supply, address _mintingAddress) {
        __ERC20_init(_name, _symbol);
        _mint(_mintingAddress, _supply);
    }
}