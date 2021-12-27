//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


import "../Funding/FaroOffering.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract DutchAuction {

    uint constant HOURS_IN_SECS = 3600;
    uint constant MAX_TIME_TICKS_ALLOWED = 1440;

    FaroOffering public immutable offerableOwnership;
    FaroFractional public immutable fractional;
    mapping (address => uint) public eligibleBidders;

    uint256 remaining;
    uint256 supply;
    address public owner;

    uint256 auctionStopPrice;
    uint256 auctionCurrentPrice;
    uint256[] priceUpdateArray;
    uint256 tickSize;

    address payable public projectFundingAddress;

    uint256 public startTime;
    uint256 public endTime;

    mapping (address => uint) private bids;

    AuctionState public auctionState;

    /// @notice An event emitted when bid happens
    event Bid(address indexed bidder, uint amount);

    enum AuctionState {
        AuctionDeployed,
        AuctionStarted,
        AuctionEnded
    }

    modifier isOwner() {
        require(msg.sender == owner, "This method can only be called by owner");
        _;
    }

    modifier isNotOwner() {
        require(msg.sender == wallet, "Owner is not allowed to bid");
        _;
    }

    modifier onlyStarted() {
        require(auctionState == AuctionState.AuctionStarted, "Auction is not live.");
        _;
    }


    modifier updateAuctionState() {
        if (block.timestamp > endTime) {
            _end();
        }
        _;
    }

    modifier updatePrice() {
        uint256 timeTick = (block.timestamp - startTime) / HOURS_IN_SECS;
        if (timeTick > tickSize) {
            timeTick = tickSize;
        }
        auctionCurrentPrice = priceUpdateArray[timeTick];
        _;
    }

    function getAuctionState() public returns(AuctionState) {
        return auctionState;
    }

    function getCurrentPrice() public updatePrice {
        return auctionCurrentPrice;
    }

    function getRemaining() public view returns(uint) {
        return remaining;
    }

    constructor(address _vaultToken, uint[] memory _priceUpdateArray, uint _supply,
        address[] memory _eligibleBidders) {
        require(_priceUpdateArray.length <= MAX_TIME_TICKS_ALLOWED, "Too large price update array");
        priceUpdateArray = _priceUpdateArray;
        offerableOwnership = FaroOffering(_vaultToken);
        require(msg.sender == offerableOwnership.owner, "Auction can only be created by offering owner");
        owner = msg.sender;
        fractional = offerableOwnership.getFractionalAddress();
        auctionCurrentPrice = priceUpdateArray[0];
        auctionState = AuctionState.AuctionDeployed;
        supply = _supply;
        createEligibleBiddersTable(_eligibleBidders);
    }

    function createEligibleBiddersTable(address[] memory _eligibleBidders) {
        for (uint i = 0; i < _eligibleBidders.length; i++) {
            eligibleBidders[_eligibleBidders[i]] = 1;
        }
    }

    function startAuction() public isOwner {
        require(auctionState == AuctionState.AuctionDeployed, "Auction is already started.");
        auctionStopPrice = offerableOwnership.getListingPrice();
        offerableOwnership.extendToDutchAuction(address(this), supply);
        projectFundingAddress = offerableOwnership.getProjectFundingAddress();
        startTime = block.timestamp;
        endTime = startTime + priceUpdateArray.length * 1 hours;
        auctionState = AuctionState.AuctionStarted;
    }

    function bid(uint256 _amount) public payable isNotOwner onlyStarted updateAuctionState updatePrice {
        require(eligibleBidders[msg.sender] == 1, "Bidder is not eligible");
        require(msg.value >= auctionCurrentPrice, "Bid value is less than current price.");
        require(_amount <= remaining, "Bid amount is higher than remaining amount.");
        remaining -= _amount;
        require(payable(projectFundingAddress).send(msg.value),
            "Could not send the funds to the project offerings address.");
        fractional.transfer(msg.sender, _amount);
        emit Bid(msg.sender, _amount);
        if (remaining == 0) {
            _end();
        }
    }

    function getFractionalBalance(address funder) public view returns(uint256) {
        return fractional.balanceOf(funder);
    }

    function end() public isOwner {
        _end();
    }

    function _end() private {
        auctionState = AuctionState.AuctionEnded;
    }
}
