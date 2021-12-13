const { expect } = require("chai");
const { ethers } = require("hardhat");
const { expectRevert } = require("@openzeppelin/test-helpers");

const NAME = "FARO Journey Starting";
const SYMBOL = "FAROM";
const TOKEN_URI = "HERE";
const TOKEN_ID = 1;

describe("FAROwnership", function () {
  before(async function () {
    const accounts = await ethers.provider.listAccounts();
    this.owner = accounts[0];
    this.user = accounts[2];
    this.user2 = accounts[3];
    this.userSigner = await ethers.getSigner(this.user);
    this.ownerSigner = await ethers.getSigner(this.owner);
    const FarownershipToken = await ethers.getContractFactory("Farownership");
    this.farownershipToken = await FarownershipToken.deploy(
      NAME,
      SYMBOL,
      TOKEN_URI
    );
    await this.farownershipToken.deployed();
  });

  it("Name is FARO Journey Starting and symbol is FAROM and token uri is HERE", async function () {
    expect(await this.farownershipToken.name()).to.equal(NAME);
    expect(await this.farownershipToken.symbol()).to.equal(SYMBOL);
    expect(await this.farownershipToken.getAgreementURI()).to.equal(TOKEN_URI);
  });

  it("The owner mints successfully", async function () {
    this.farownershipToken.connect(this.ownerSigner);
    const mintTx = await this.farownershipToken.mint(this.owner);
    await mintTx.wait();
    expect(await this.farownershipToken.getAgreementURI()).to.equal(TOKEN_URI);
    expect(await this.farownershipToken.ownerOf(TOKEN_ID)).to.equal(this.owner);
  });

  it("Non-owner cannot send it.", async function () {
    this.farownershipToken.connect(this.user);
    await expectRevert(
      this.farownershipToken.transferFrom(this.user, this.user2, TOKEN_ID),
      "ERC721: transfer of token that is not own"
    );
  });

  it("Owner can send it successfully.", async function () {
    this.farownershipToken.connect(this.ownerSigner);
    const tx = await this.farownershipToken.transferFrom(
      this.owner,
      this.user,
      TOKEN_ID
    );
    await tx.wait();
    expect(await this.farownershipToken.ownerOf(TOKEN_ID)).to.equal(this.user);
  });
});
