//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";


contract EnglishAuction {

    uint256 constant maxAuctionPeriod = 31536000;

    address public owner;
    uint256 public bidIncrement;
    uint256 public endTime;
    uint256 public startTime;
    uint256 auctionPeriodInSeconds;
    uint256 public floorPrice;
    
    /// @notice the ERC721 token address of the vault's token
    ERC721 public token;
    uint256 public tokenId;
    
    uint256 public highestBindingBid;
    address public highestBidder;
    mapping(address => uint256) public bids;

    bool ownerHasWithdrawn;
    AuctionState public auctionState;

    event Bid(address bidder, uint256 bid, address highestBidder, uint256 highestBid, uint256 highestBindingBid);
    event Withdrawal(address withdrawer, address withdrawalAccount, uint256 amount);
    event Cancelled();
    event End(address _highestBidder, uint256 _highestBid);

    enum AuctionState {
        AuctionDeployed,
        AuctionStarted,
        AuctionEnded,
        AuctionCancelled
    }

    modifier onlyOwner {
        if (msg.sender != owner) revert("Only owner can perform this operation.");
        _;
    }

    modifier onlyNotOwner {
        require(msg.sender != owner, "Owner cannot perform this operation.");
        _;
    }

    modifier onlyDeployed {
        require(auctionState == AuctionState.AuctionDeployed, "Auction's already started.");
        _;
    }

    modifier onlyLive {
        _end();
        require(auctionState == AuctionState.AuctionStarted, "Auction is not live.");
        _;
    }

    modifier notCancelled {
        require(auctionState != AuctionState.AuctionCancelled, "Auction is not cancelled");
        _;
    }

    modifier cancelled {
        require(auctionState == AuctionState.AuctionCancelled, "Auction is cancelled.");
        _;
    }

    modifier onlyEnded {
        _end();
        require(auctionState == AuctionState.AuctionEnded, "Auction must be ended for this operation.");
        _;
    }

    modifier endedOrCancelled() {
        _end();
        require(auctionState == AuctionState.AuctionCancelled || auctionState == AuctionState.AuctionEnded,
            "Auction did not end or was cancelled.");
        _;
    }

    constructor(address _owner, uint256 _bidIncrement, uint256 _auctionPeriodInSeconds,
        address _token, uint256 _tokenId, uint256 _floorPrice) {
        require(IERC721(_token).ownerOf(_tokenId) == _owner, "Auction can only be deployed by the owner of the token.");
        require(auctionPeriodInSeconds < maxAuctionPeriod, "Auction period cannot be more than 1 year");
        owner = _owner;
        bidIncrement = _bidIncrement;
        auctionPeriodInSeconds = _auctionPeriodInSeconds;
        token = ERC721(_token);
        tokenId = _tokenId;
        auctionState = AuctionState.AuctionDeployed;
        floorPrice = _floorPrice * 1 ether;
    }

    function getHighestBid() public view returns (uint256) {
        return bids[highestBidder];
    }

    function getBidForAnAddress(address bidder) public view returns (uint256) {
        return bids[bidder];
    }

    function getAuctionState() public view returns(AuctionState) {
        return auctionState;
    }

    function start() public onlyOwner onlyDeployed {
        auctionState = AuctionState.AuctionStarted;
        startTime = block.timestamp;
        endTime = startTime + auctionPeriodInSeconds * 1 seconds;
    }

    function bid() public payable onlyLive onlyNotOwner returns (bool success) {
        // reject payments of 0 ETH
       require(msg.value > floorPrice, "Cannot send bid less than floor price.");

        // calculate the user's total bid based on the current amount they've sent to the contract
        // plus whatever has been sent with this transaction
        uint256 newBid = bids[msg.sender] + msg.value;

        // if the user isn't even willing to overbid the highest binding bid, there's nothing for us
        // to do except revert the transaction.
        require(newBid > highestBindingBid, "Bid amount is less than highest");

        // grab the previous highest bid (before updating bids, in case msg.sender is the
        // highestBidder and is just increasing their maximum bid).
        uint256 highestBid = bids[highestBidder];
        bids[msg.sender] = newBid;

        if (newBid <= highestBid) {
            // if the user has overbid the highestBindingBid but not the highestBid, we simply
            // increase the highestBindingBid and leave highestBidder alone.

            // note that this case is impossible if msg.sender == highestBidder because you can never
            // bid less ETH than you've already bid.

            highestBindingBid = min(newBid + bidIncrement, highestBid);
        } else {
            // if msg.sender is already the highest bidder, they must simply be wanting to raise
            // their maximum bid, in which case we shouldn't increase the highestBindingBid.

            // if the user is NOT highestBidder, and has overbid highestBid completely, we set them
            // as the new highestBidder and recalculate highestBindingBid.

            if (msg.sender != highestBidder) {
                highestBidder = msg.sender;
                highestBindingBid = min(newBid, highestBid + bidIncrement);
            }
            highestBid = newBid;
        }

        emit Bid(msg.sender, newBid, highestBidder, highestBid, highestBindingBid);
        return true;
    }

    function min(uint256 a, uint256 b) private pure returns (uint256) {
        if (a < b) return a;
        return b;
    }

    function cancelAuction() public onlyOwner onlyLive returns (bool success) {
        auctionState = AuctionState.AuctionCancelled;
        emit Cancelled();
        return true;
    }

    function _end() internal {
        if (block.timestamp > endTime && auctionState == AuctionState.AuctionStarted) {
            auctionState = AuctionState.AuctionEnded;
            emit End(highestBidder, bids[highestBidder]);
        }
    }

    function withdrawNFT() external onlyEnded {
        require(msg.sender == highestBidder, "Only the highest bidder can withdraw the auction item.");
        token.transferFrom(address(this), msg.sender, tokenId);
    }

    function withdrawNFTWhenCancelled() external onlyOwner cancelled {
        token.transferFrom(address(this), msg.sender, tokenId);
    }

    function withdraw() external endedOrCancelled {
        address withdrawalAccount;
        uint256 withdrawalAmount;
        require(bids[msg.sender] > 0, "Sender has no bids to withdraw.");
        if (auctionState == AuctionState.AuctionCancelled) {
            // if the auction was cancelled, everyone should simply be allowed to withdraw their funds
            withdrawalAccount = msg.sender;
            withdrawalAmount = bids[withdrawalAccount];

        } else {
            // the auction finished without being cancelled

            if (msg.sender == owner) {
                // the auction's owner should be allowed to withdraw the highestBindingBid
                withdrawalAccount = highestBidder;
                withdrawalAmount = highestBindingBid;
                ownerHasWithdrawn = true;

            } else if (msg.sender == highestBidder) {
                // the highest bidder should only be allowed to withdraw the difference between their
                // highest bid and the highestBindingBid
                withdrawalAccount = highestBidder;
                withdrawalAmount = bids[highestBidder] - highestBindingBid;
            } else {
                // anyone who participated but did not win the auction should be allowed to withdraw
                // the full amount of their funds
                withdrawalAccount = msg.sender;
                withdrawalAmount = bids[withdrawalAccount];
            }
        }
        require(withdrawalAmount > 0, "Withdrawal amount cannot be 0");
        bids[withdrawalAccount] -= withdrawalAmount;
        // send the funds
        require(payable(withdrawalAccount).send(withdrawalAmount), "Transfer amount not successful");
        emit Withdrawal(msg.sender, withdrawalAccount, withdrawalAmount);
    }
}


