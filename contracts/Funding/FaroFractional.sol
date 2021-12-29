//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FaroFractional is ERC20, Ownable {

    constructor(string memory _name, string memory _symbol, uint256 _supply,
        address _mintingAddress) ERC20(_name, _symbol) {
        _mint(_mintingAddress, _supply);
    }

    function mint(uint _supply, address _mintingAddress) public onlyOwner {
        _mint(_mintingAddress, _supply);
    }
}