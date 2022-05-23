// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import {FaroNFTFactory} from './FaroNFTFactory.sol';
import {FaroEnglishAuction} from '../EnglishAuctions/FaroEnglishAuction.sol';


contract FaroMarketplace {

    enum SaleState {
        SaleStarted,
        SalePaused,
        SaleEnded,
        SaleCancelled
    }

    struct MarketplaceItem {
        address token;
        address owner;
        address winner;
        uint floorPrice;
        uint tokenId;
        SaleState saleState;
        bool withdrawn;
    }

    mapping(address => mapping(address => mapping(uint => MarketplaceItem))) marketplaceItems;
    FaroNFTFactory faroNFTFactory;
    FaroEnglishAuction faroEnglishAuction;

    constructor(address _faroNFTFactory, address _faroEnglishAuction) {
        faroNFTFactory = FaroNFTFactory(_faroNFTFactory);
        faroEnglishAuction = FaroEnglishAuction(_faroEnglishAuction);
        require(msg.sender == faroEnglishAuction.owner(), "Marketplace creator must be the owner of English auction factory");
        require(msg.sender == faroNFTFactory.owner(), "Marketplace creator must be the owner of Faro NFT factory");
    }

    function registerNFTItem(address _token, uint _floorPrice, uint _tokenId) external {
        require(faroNFTFactory.getNFTByAddress(_token) > 0, "Is not a FARO NFT");
        require(IERC721(_token).ownerOf(_tokenId) == msg.sender,
            "Auction can only be deployed by the owner of the token.");
        marketplaceItems[msg.sender][_token][_tokenId] = MarketplaceItem(_token, msg.sender, address(0),
            _floorPrice, _tokenId, SaleState.SaleStarted, false);
        IERC721(_token).transferFrom(msg.sender, address(this), _tokenId);
    }

    function offer(address _token, uint _tokenId, address _owner) payable external returns (bool) {
        MarketplaceItem memory item = marketplaceItems[_owner][_token][_tokenId];
        require(item.saleState == SaleState.SaleStarted, "Item is not for sale.");
        require(msg.sender != item.owner, "Owner cannot bid.");
        if (msg.value >= item.floorPrice) {
            item.saleState = SaleState.SaleEnded;
            item.winner = msg.sender;
            marketplaceItems[_owner][_token][_tokenId] = item;
            require(payable(address(this)).send(item.floorPrice), "Transfer amount not successful");
            return true;
        }
        return false;
    }

    function withdrawItem(address _token, uint _tokenId, address _owner) external {
        MarketplaceItem memory item = marketplaceItems[_owner][_token][_tokenId];
        require(item.saleState == SaleState.SaleEnded, "Sale is still live");
        require(item.winner == msg.sender, "Unauthorized withdrawal attempt, msg.sender is not winner");
        require(item.withdrawn == false, "Item was already withdrawn");
        item.withdrawn = true;
        marketplaceItems[_owner][_token][_tokenId] = item;
        IERC721(_token).transferFrom(address(this), msg.sender, _tokenId);
    }

    function withdrawPaidAmount(address _token, uint _tokenId, address _owner) external {
        MarketplaceItem memory item = marketplaceItems[_owner][_token][_tokenId];
        require(payable(address(_owner)).send(item.floorPrice), "Transfer from the contract to owner not successful");
    }
}
