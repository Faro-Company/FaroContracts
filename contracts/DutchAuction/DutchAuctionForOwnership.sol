// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "../Funding/OfferableERC721TokenVault.sol";


contract DutchAuction {
    event Buy(address winner, uint amount);

    OfferableERC721TokenVault public immutable offerableOwnership;
    uint constant FifteenMinsInMilliSecs = 900000;
    address payable public seller;
    uint public startingPrice;
    uint public startAt;
    uint public expiresAt;
    uint public priceDeductionRate;
    address public winner;

    constructor(
        uint _startingPrice,
        address vaultToken,
        uint[] memory _priceDeductionArray
    ) {
        seller = payable(msg.sender);
        startingPrice = _startingPrice;
        startAt = block.timestamp;
        priceDeductionArray = _priceDeductionArray;
        expiresAt = block.timestamp + priceDeductionRate.length * 15 minutes;
        offerableOwnership = vaultToken;
    }

    function buy(uint _amount) external payable {
        require(block.timestamp < expiresAt, "auction expired");
        require(winner != address(0), "auction finished");
        require(offerableOwnership.balanceOf(seller) >= _amount, "Not enough amount available for sale");
        uint timeElapsed = (block.timestamp - startAt) % FifteenMinsInMilliSecs;
        uint price = startingPrice - priceDeductionArray[timeElapsed];
        require(msg.value >= price, "ETH < price");
        winner = msg.sender;
        offerableOwnership.transferFrom(seller, msg.sender, amount);
        seller.transfer(msg.value);
        emit Buy(msg.sender, msg.value);
    }
}
