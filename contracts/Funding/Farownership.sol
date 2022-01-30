//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";


contract Farownership is ERC721 {

    string baseURI;
    bool minted;

    constructor(string memory _contentName, string memory _symbol, string memory _agreementUri) ERC721(_contentName, _symbol) {
        require(bytes(_agreementUri).length > 0, "Need to provide the URI of the agreement");
        baseURI  = _agreementUri;
    }

    function mint(address _to) external {
        require(!minted, "Ownership already minted, cannot mint more than once");
        minted = true;
        _mint(_to, 1);
    }

    function getAgreementURI() public view returns (string memory) {
        return baseURI;
    }
}
