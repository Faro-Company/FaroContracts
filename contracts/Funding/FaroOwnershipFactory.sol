//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./Farownership.sol";


contract FaroOwnershipFactory is Ownable, Pausable {

    uint256 private ownershipCount;

    address[] public ownerships;

    event OwnershipCreated(address indexed token);

    function createOwnership(string memory _contentName, string memory _symbol, string memory _agreementUri,
        address ownerAddress) external onlyOwner whenNotPaused returns(uint256) {
        Farownership ownership = new Farownership(_contentName, _symbol, _agreementUri);
        ownership.mint(ownerAddress);
        address newOwnership = address(ownership);
        ownerships.push(newOwnership);
        ownershipCount++;
        emit OwnershipCreated(newOwnership);
        return ownershipCount;
    }

    function getLastOwnership() public view returns (address) {
        require(ownerships.length > 0, "There aren't any ownerships created");
        return ownerships[ownershipCount - 1];
    }

    function getNumOfTokens() public view returns (uint256) {
        return ownershipCount;
    }

    function getOwnership(uint256 ownershipNum) public view returns (address) {
        return ownerships[ownershipNum];
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
