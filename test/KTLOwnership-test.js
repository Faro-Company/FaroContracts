const { expect } = require("chai");
const { ethers } = require("hardhat");
const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');


const NAME = "KTLO Journey Starting";
const SYMBOL = "KTLOM";
const TOKEN_URI = "HERE";
const TOKEN_ID = 1;

describe('KTLOwnership', function () {

  before(async function () {
    const accounts = await ethers.provider.listAccounts();
    this.owner = accounts[0];
    this.user = accounts[2];
    this.user2 = accounts[3];
    this.userSigner = await ethers.getSigner(this.user);
    this.ownerSigner = await ethers.getSigner(this.owner);
    const KtlOwnershipToken = await ethers.getContractFactory('KTLOwnership');
    this.ktlOwnershipToken = await KtlOwnershipToken.deploy(NAME, SYMBOL, TOKEN_URI);
    await this.ktlOwnershipToken.deployed();
  });

  it('Name is KTLO Journey Starting and symbol is KTLOM and token uri is HERE', async function () {
    expect((await this.ktlOwnershipToken.name())).to.equal(NAME);
    expect((await this.ktlOwnershipToken.symbol())).to.equal(SYMBOL);
    expect((await this.ktlOwnershipToken.getAgreementURI())).to.equal(TOKEN_URI);
  });

  it('The owner mints successfully', async function() {
    this.ktlOwnershipToken.connect(this.ownerSigner);
    let mintTx = await this.ktlOwnershipToken.mint(this.owner);
    await mintTx.wait();
    expect(await this.ktlOwnershipToken.getAgreementURI()).to.equal(TOKEN_URI);
    expect(await this.ktlOwnershipToken.ownerOf(TOKEN_ID)).to.equal(this.owner);
  });

  it('Non-owner cannot send it.', async function () {
    this.ktlOwnershipToken.connect(this.user);
    let tx = await this.ktlOwnershipToken.transferFrom(this.user, this.user2, TOKEN_ID);
    await tx.wait();
    await expectRevert(this.ktlOwnershipToken.ownerOf(TOKEN_ID));
  });

  it('Owner can send it successfully.', async function () {
    this.ktlOwnershipToken.connect(this.ownerSigner);
    let tx = await this.ktlOwnershipToken.transferFrom(this.owner, this.user, TOKEN_ID);
    await tx.wait();
    expect(await this.ktlOwnershipToken.ownerOf(TOKEN_ID)).to.equal(this.user);
  });

});
