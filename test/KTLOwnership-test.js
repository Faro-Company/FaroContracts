const { expect } = require("chai");
const { ethers } = require("hardhat");
const { accounts, contract } = require('@openzeppelin/test-environment');
const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

const [owner, deployer, user] = accounts;
const NAME = "KTLO Journey Starting";
const SYMBOL = "KTLOM";
const TOKEN_URI = "HERE";

const KtlOwnershipToken = contract.fromArtifact("KTLOwnership");

describe('KTLOToken', function () {

  before(async function () {
    this.ktlOwnershipToken = await KtlOwnershipToken.new(NAME, SYMBOL, TOKEN_URI);
  });

  it('Name is KTLO Journey Starting and symbol is KTLOM and token uri is HERE', async function () {
    expect((await this.ktlOwnershipToken.name())).to.equal(NAME);
    expect((await this.ktlOwnershipToken.symbol())).to.equal(SYMBOL);
    expect((await this.ktlOwnershipToken.tokenURI())).to.equal(TOKEN_URI);
  });

  it('The owner mints successfully', async function() {
    let mintTx = await ktlOwnershipToken.mint(owner, {from: owner});
    await mintTx.wait();
    expect(await this.ktlOwnershipToken.ownerOf(1, {from: owner})).to.equal(owner);
  })

  // Test case
  it('Name and symbol of NFT is correct.', async function () {
    // Store a value
    expect((await this.ktlOwnershipToken.name())).to.equal("KTLO Journey Starting");
    expect((await this.ktlOwnershipToken.symbol())).to.equal("KTLO");
  });
});
