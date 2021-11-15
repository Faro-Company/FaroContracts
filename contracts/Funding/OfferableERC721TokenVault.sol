//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";


contract OfferableERC721TokenVault is ERC20Upgradeable, ERC721HolderUpgradeable {

    Utils utils = new Utils();

    /// -----------------------------------
    /// -------- TOKEN INFORMATION --------
    /// -----------------------------------

    /// @notice the ERC721 token address of the vault's token
    address public token;

    /// @notice The project's funding address where stable coins are to be sent
    address payable public projectFundingAddress;

    /// @notice the ERC721 token ID of the vault's token
    uint256 public id;

    /// @notice Price of the share
    uint256 public listingPrice;

    /// @notice the length of auctions
    uint256 public listingPeriod;

    /// @notice the unix timestamp end time of the token auction
    uint256 public listingEnd;

    enum State { inactive, live, ended, overfunded}

    State public listingState;

    uint constant minPrice = 1;

    /// @notice a mapping of users to their funding amounts
    mapping(address => uint256) public funders;

    uint public remaining;

    /// @notice An event emitted when a listing starts
    event Start(address starter, uint256 value);

    /// @notice An event emitted when bid happens
    event Bid(address bidder, uint amount);

    /// @notice An event emitted when end happens
    event End();

    modifier isOwner() {
        if (msg.sender != projectFundingAddress)
            revert("Sender is not the project owner.");
        _;
    }

    function initialize(address _token, address payable _projectFundingAddress, uint256 _id,
        uint256 _supply, uint256 _listingPrice, string memory _name, string memory _symbol,
        address[] memory funderAddresses, uint[] memory allocations) external initializer {
        // initialize inherited contracts
        __ERC20_init(_name, _symbol);
        __ERC721Holder_init();
        // set storage variables
        token = _token;
        projectFundingAddress = _projectFundingAddress;
        id = _id;
        listingPeriod = 3 days;
        listingState = State.inactive;
        listingPrice = _listingPrice;

        require(_createFundersMapping(funderAddresses, allocations) == _supply,
            "Given supply is not equal to the sum of allocations");
        _mint(projectFundingAddress, _supply);
        remaining = _supply;
    }

    function _createFundersMapping(address[] memory funderAddresses, uint[] memory allocations) internal returns (uint) {
        require(funderAddresses.length == allocations.length, "Funders and allocation array sizes cannot be different");
        uint total = 0;
        for (uint i = 0; i < funderAddresses.length; i++) {
            funders[funderAddresses[i]] = allocations[i];
            total += allocations[i];
        }
        return total;
    }

    /// @notice Start the offering
    function start() external payable isOwner {
        require(listingState == State.inactive, "Offering is already live");
        listingEnd = block.timestamp + listingPeriod;
        listingState = State.live;
        emit Start(msg.sender, msg.value);
    }

    /// @notice an external function to bid on purchasing the vaults NFT. The msg.value is the bid amount
    function bid(uint _amount) external payable {
        require(_amount > 0, "Bid amount cannot be zero");
        require(funders[msg.sender] >= _amount, "Bid is more than allocated for this address");
        require(listingState == State.live, "Offering is not live");
        require(_amount * listingPrice <= msg.value, "Funds sent for bid is less than the total capital required to buy the amount");
        require(block.timestamp > listingEnd, "Offering period is over");
        require(remaining >= _amount, "Remaining is less than the amount that is bid");
        remaining -= _amount;
        funders[msg.sender] -= funders[msg.sender];
        require(utils.sendStableCoin(msg.sender, projectFundingAddress,
            msg.value), "Could not send the funds to the project offerings address");
        IERC20(address(this)).transferFrom(address(this), msg.sender, _amount);
        emit Bid(msg.sender, _amount);
    }

    /// @notice an external function to end an auction after the timer has run out
    function end() external {
        require(listingState == State.live, "Offering is already closed");
        require(block.timestamp >= listingEnd, "Listing period is not over");
        // transfer erc721 to winner
        listingState = State.ended;
        emit End();
    }


}
