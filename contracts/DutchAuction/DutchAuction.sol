//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils.sol";
import "../Funding/OfferableERC721TokenVault.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract DutchAuction {

    Utils utils = new Utils();

    /// @notice usdc address
    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    /// @notice An event emitted when bid happens
    event Bid(address indexed bidder, uint amount);
    uint constant HOURS_IN_MILLISECS = 3600000;
    uint constant MAX_TIME_TICKS_ALLOWED = 1440;

    OfferableERC721TokenVault public immutable offerableOwnership;
    uint maxTokensSold;
    uint remaining;

    uint256 auctionStopPrice;
    uint256 auctionCurrentPrice;
    uint256[] priceUpdateArray;

    address payable public wallet;

    uint256 public startTime;
    uint256 public endTime;

    mapping (address => uint) private bids;

    AuctionState public auctionState;

    enum AuctionState {
        AuctionDeployed,
        AuctionStarted,
        AuctionEnded
    }

    modifier atState(AuctionState _auctionState) {
        if (auctionState != _auctionState)
            revert("Auction is in unexpected state.");
        _;
    }

    modifier isOwner() {
        if (msg.sender != wallet)
            revert("Sender is not the project owner");
        _;
    }

    modifier isNotOwner() {
        if (msg.sender == wallet)
            revert("Owner is not allowed to bid");
        _;
    }


    modifier updateAuctionState() {
        if (auctionState == AuctionState.AuctionStarted && (block.timestamp > endTime || calculatePrice() <= auctionStopPrice))
            finalizeAuction();
        _;
    }

    constructor(address vaultToken, uint[] memory _priceUpdateArray) {
        require(_priceUpdateArray.length <= MAX_TIME_TICKS_ALLOWED, "Too large price update array");
        priceUpdateArray = _priceUpdateArray;
        offerableOwnership = OfferableERC721TokenVault(vaultToken);
        auctionCurrentPrice = priceUpdateArray[0];
        auctionState = AuctionState.AuctionDeployed;
        remaining = maxTokensSold;
    }

    function startAuction() public isOwner atState(AuctionState.AuctionDeployed) {
        auctionStopPrice = offerableOwnership.listingPrice();
        maxTokensSold = offerableOwnership.remaining();
        wallet = offerableOwnership.projectFundingAddress();
        startTime = block.timestamp;
        endTime = startTime + priceUpdateArray.length * 1 hours;
        auctionState = AuctionState.AuctionStarted;
    }

    function calculatePrice() public returns (uint256) {
        uint256 timeTick = (block.timestamp - startTime) % HOURS_IN_MILLISECS;
        auctionCurrentPrice = priceUpdateArray[timeTick];
        return auctionCurrentPrice;
    }

    function bid(uint256 _amount) public payable atState(
        AuctionState.AuctionStarted) isNotOwner updateAuctionState {
        require(msg.value >= auctionCurrentPrice, "Bid value is less than current price.");
        require(_amount <= remaining, "Bid amount is higher than remaining amount.");
        remaining = remaining - _amount;
        bids[msg.sender] += msg.value;
        require(utils.sendStableCoin(msg.sender, wallet,
            msg.value), "Could not send the funds to the project offerings address.");
        IERC20(address(offerableOwnership)).transferFrom(wallet, msg.sender, _amount);
        emit Bid(msg.sender, _amount);
        if (remaining == 0) {
            finalizeAuction();
        }
    }

    function finalizeAuction() private {
        auctionState = AuctionState.AuctionEnded;
    }

    function withdraw() public atState(AuctionState.AuctionEnded) {
        require(bids[msg.sender] > 0, "Not among bidders.");
        require(utils.sendStableCoin(wallet, msg.sender, bids[msg.sender] - auctionCurrentPrice),
            "Could not send change to the bidding participant.");
    }
}
