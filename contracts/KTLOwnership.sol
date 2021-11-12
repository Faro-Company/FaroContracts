//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";


contract KTLOwnership is ERC721{

    string baseURI;

    constructor(string memory _contentName, string memory _symbol, string memory _agreementUri) ERC721(_contentName, _symbol) {
        require(bytes(_agreementUri).length > 0, "Need to provide the URI of the agreement");
        baseURI  = _agreementUri;
    }

    function mint(address _to) external {
        _safeMint(_to, 1);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
        return string(abi.encodePacked(baseURI, tokenId));
    }
}
