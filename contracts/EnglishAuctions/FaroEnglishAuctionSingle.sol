//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FaroEnglishAuctionSingle is Ownable, Pausable {
  enum AuctionState {
    AuctionCreated,
    AuctionStarted,
    AuctionEnded,
    AuctionCancelled
  }

  enum Action {
    Create,
    Start,
    Cancel,
    Bid,
    End
  }

  struct Token {
    address tokenAddr;
    uint256 tokenId;
  }

  struct Auction {
    uint256 auctionId;
    address tokenOwner;
    Token token;
    uint256 startTime;
    uint256 duration;
    uint256 floorPrice;
    address highestBidder;
    uint256 highestBindingBid;
    AuctionState auctionState;
  }

  uint256 private constant maxAuctionPeriod = 365 days;
  uint256 private auctionCount;
  Auction[] private allAuctions;
  mapping(bytes32 => uint256[]) private tokenToAuctIndices;
  mapping(uint256 => mapping(address => uint256)) private auctIdToBids;

  Auction private dummyAuction; // for initial storage pointing

  constructor() {
    // fill in later
    // !!!!!!!!!!!!!!!!!!!!!!!EVENTS!!!!!!!!!!!!!!!!
  }

  function createAuction(
    address tokenAddr,
    uint256 tokenId,
    uint256 auctDuration,
    uint256 floorPrice
  ) external whenNotPaused {
    Token memory token = Token(tokenAddr, tokenId);
    _checkIfTokenOwner(token, msg.sender);
    Auction memory newAuctionData;
    newAuctionData.token = token;
    newAuctionData.duration = auctDuration;
    newAuctionData.floorPrice = floorPrice;
    _executeAction(newAuctionData, Action.Create);
  }

  function startAuction(address tokenAddr, uint256 tokenId) external {
    Token memory token = Token(tokenAddr, tokenId);
    _checkIfTokenOwner(token, msg.sender);
    Auction memory data;
    data.token = token;
    _executeAction(data, Action.Start);
  }

  function cancelAuction(address tokenAddr, uint256 tokenId) external {
    Token memory token = Token(tokenAddr, tokenId);
    _checkIfTokenOwner(token, msg.sender);
    Auction memory data;
    data.token = token;
    _executeAction(data, Action.Cancel);
  }

  function endAuction(address tokenAddr, uint256 tokenId) external {
    Token memory token = Token(tokenAddr, tokenId);
    _checkIfTokenOwner(token, msg.sender);
    Auction memory data;
    data.token = token;
    _executeAction(data, Action.End);
  }

  function _executeAction(Auction memory _inputData, Action _action) internal {
    Token memory token = _inputData.token;
    (uint256 lenTokenAucts, uint256 indexLastTokenAuct, uint256[] storage tokenAuctIndices) = _getTokenAuctData(token);
    Auction storage lastTokenAuct = dummyAuction;
    AuctionState auctState;
    bool existsAuctionForToken = false;

    if (lenTokenAucts > 0) {
      lastTokenAuct = allAuctions[indexLastTokenAuct];
      auctState = lastTokenAuct.auctionState;
      existsAuctionForToken = true;
      // if auction is expired, update accordingly
      uint256 endTime = lastTokenAuct.startTime + lastTokenAuct.duration;
      if (block.timestamp > endTime && auctState == AuctionState.AuctionStarted) {
        lastTokenAuct.auctionState = AuctionState.AuctionEnded;
        //emit event
      }
    }

    if (_action == Action.Create) {
      if (existsAuctionForToken) {
        bool createEligible = auctState == AuctionState.AuctionEnded || auctState == AuctionState.AuctionCancelled;
        require(createEligible, "A live or in created-state auction exists for this token");
      }
      require(_inputData.duration < maxAuctionPeriod, "Auction duration too long");
      _inputData.auctionId = auctionCount;
      _inputData.tokenOwner = msg.sender;
      allAuctions.push(_inputData);
      tokenAuctIndices.push(_inputData.auctionId);
      auctionCount++;
      // emit event
    } else if (_action == Action.Start) {
      if (existsAuctionForToken) {
        require(auctState == AuctionState.AuctionCreated, "Auction is not in created-state");
        lastTokenAuct.startTime = block.timestamp;
        lastTokenAuct.auctionState = AuctionState.AuctionStarted;
        // emit event
      } else {
        revert("No auction to start for this token");
      }
    } else if (_action == Action.Cancel) {
      if (existsAuctionForToken) {
        require(auctState == AuctionState.AuctionStarted, "Auction is not live");
        lastTokenAuct.auctionState = AuctionState.AuctionCancelled;
        // emit event
      } else {
        revert("No auction to cancel for this token");
      }
    } else if (_action == Action.End) {
      // auction ending is already perfomed above
      if (existsAuctionForToken) {
        require(auctState == AuctionState.AuctionEnded, "Auction cannot be ended");
      } else {
        revert("No auction to end for this token");
      }
    }
  }

  // Internal Functions

  function _bid(Auction storage _auction) internal {}

  function _getTokenAuctData(Token memory _token)
    internal
    view
    returns (
      uint256 _lenTokenAucts,
      uint256 _indexLastTokenAuct,
      uint256[] storage _tokenAuctIndices
    )
  {
    bytes32 tokenHash = _calcTokenHash(_token);
    _tokenAuctIndices = tokenToAuctIndices[tokenHash];
    _lenTokenAucts = _tokenAuctIndices.length;
    _indexLastTokenAuct = _lenTokenAucts > 0 ? _tokenAuctIndices[_lenTokenAucts - 1] : 0;
  }

  // Helper Functions
  function _calcTokenHash(Token memory _token) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked(_token.tokenAddr, _token.tokenId));
  }

  function _checkIfTokenOwner(Token memory token, address caller) internal {
    require(IERC721(token.tokenAddr).ownerOf(token.tokenId) == caller, "Caller is not token owner");
  }

  function _checkIfNotTokenOwner(Token memory token, address caller) internal {
    require(IERC721(token.tokenAddr).ownerOf(token.tokenId) != caller, "Caller not token owner");
  }

  // function _end(Token memory token) internal view {
  //     bytes32 tokenHash = _calcTokenHash(token);
  // }
}

contract FaroEnglishAuctionDel {
  uint256 constant maxAuctionPeriod = 31536000;

  address public owner;
  uint256 public bidIncrement;
  uint256 public endTime;
  uint256 public startTime;
  uint256 auctionPeriodInSeconds;
  uint256 public floorPrice;

  IERC721 public token;
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

  modifier onlyOwner() {
    if (msg.sender != owner) revert("Only owner can perform this operation.");
    _;
  }

  modifier onlyNotOwner() {
    require(msg.sender != owner, "Owner cannot perform this operation.");
    _;
  }

  modifier onlyDeployed() {
    require(auctionState == AuctionState.AuctionDeployed, "Auction's already started.");
    _;
  }

  modifier onlyLive() {
    _end();
    require(auctionState == AuctionState.AuctionStarted, "Auction is not live.");
    _;
  }

  modifier notCancelled() {
    require(auctionState != AuctionState.AuctionCancelled, "Auction is not cancelled");
    _;
  }

  modifier cancelled() {
    require(auctionState == AuctionState.AuctionCancelled, "Auction is cancelled.");
    _;
  }

  modifier onlyEnded() {
    _end();
    require(auctionState == AuctionState.AuctionEnded, "Auction must be ended for this operation.");
    _;
  }

  modifier endedOrCancelled() {
    _end();
    require(
      auctionState == AuctionState.AuctionCancelled || auctionState == AuctionState.AuctionEnded,
      "Auction did not end or was cancelled."
    );
    _;
  }

  constructor(
    address _owner,
    uint256 _bidIncrement,
    uint256 _auctionPeriodInSeconds,
    address _token,
    uint256 _tokenId,
    uint256 _floorPrice
  ) {
    require(IERC721(_token).ownerOf(_tokenId) == _owner, "Auction can only be deployed by the owner of the token.");
    require(auctionPeriodInSeconds < maxAuctionPeriod, "Auction period cannot be more than 1 year");
    owner = _owner;
    bidIncrement = _bidIncrement;
    auctionPeriodInSeconds = _auctionPeriodInSeconds;
    token = IERC721(_token);
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

  function end() public {
    _end();
  }

  function start() public onlyOwner onlyDeployed {
    auctionState = AuctionState.AuctionStarted;
    startTime = block.timestamp;
    endTime = startTime + auctionPeriodInSeconds * 1 seconds;
  }

  function bid() public payable onlyLive onlyNotOwner returns (bool success) {
    require(msg.value > floorPrice, "Cannot send bid less than floor price.");
    uint256 newBid = bids[msg.sender] + msg.value;
    require(newBid > highestBindingBid, "Bid amount is less than highest");
    uint256 highestBid = bids[highestBidder];
    bids[msg.sender] = newBid;

    if (newBid <= highestBid) {
      highestBindingBid = min(newBid + bidIncrement, highestBid);
    } else {
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
      withdrawalAccount = msg.sender;
      withdrawalAmount = bids[withdrawalAccount];
    } else {
      if (msg.sender == owner) {
        withdrawalAccount = highestBidder;
        withdrawalAmount = highestBindingBid;
        ownerHasWithdrawn = true;
      } else if (msg.sender == highestBidder) {
        withdrawalAccount = highestBidder;
        withdrawalAmount = bids[highestBidder] - highestBindingBid;
      } else {
        withdrawalAccount = msg.sender;
        withdrawalAmount = bids[withdrawalAccount];
      }
    }
    require(withdrawalAmount > 0, "Withdrawal amount cannot be 0.");
    bids[withdrawalAccount] -= withdrawalAmount;
    require(payable(withdrawalAccount).send(withdrawalAmount), "Transfer amount not successful");
    emit Withdrawal(msg.sender, withdrawalAccount, withdrawalAmount);
  }
}
