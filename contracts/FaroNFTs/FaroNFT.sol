//SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract FaroNFT is ERC721 {

    string baseURI;
    uint256 contentID;

    constructor(string memory _contentName, string memory _symbol,
        string memory _agreementUri, uint256 _contentID) ERC721(_contentName, _symbol) {
        require(bytes(_agreementUri).length > 0, "Need to provide the URI of the agreement");
        baseURI  = _agreementUri;
        contentID = _contentID;
    }

    function mint(address _to, uint256 _tokenID) external {
        _mint(_to, _tokenID);
    }

    function getAgreementURI() public view returns (string memory) {
        return baseURI;
    }
}
