const { expect } = require("chai");
const { ethers } = require("hardhat");
const { expectRevert } = require("@openzeppelin/test-helpers");

const NAME = "FARO Journey Starting";
const SYMBOL = "FAROM";
const TOKEN_URI = "HERE";

describe("FaroOffering", function () {

    before(async function () {
        await ethers.provider.send("hardhat_reset");
        const accounts = await ethers.provider.listAccounts();
        this.owner = accounts[0];
        this.user = accounts[1];
        this.user2 = accounts[2];
        this.ownerSigner = await ethers.getSigner(this.owner);
        this.projectFundRaisingSigner = await ethers.getSigner(this.user);
        this.distributor = await ethers.getSigner(this.user2);

        const FaroOwnershipFactory = await ethers.getContractFactory("FaroOwnershipFactory");
        const faroOwnershipFactory = await FaroOwnershipFactory.deploy();
        await faroOwnershipFactory.deployed();
        this.faroOwnershipFactoryAddress = this.ercVaultFactory.address;
    });

    it("Non owner cannot create", async function () {
        this.faroOwnershipWithSigner = faroOwnershipFactory.connect(this.projectFundRaisingSigner);
        await expectRevert(faroOwnershipWithSigner.createOwnership(
            NAME,
            SYMBOL,
            TOKEN_URI,
            this.user
        ), "Caller is not the owner");
    });

    it("FARO Ownership created ", async function () {
        this.faroOwnershipWithSigner = faroOwnershipFactory.connect(this.ownerSigner);
        tx = await faroOwnershipWithSigner.createOwnership(
            NAME,
            SYMBOL,
            TOKEN_URI,
            this.user
        );
        await tx.wait();
        expect((await faroOwnershipWithSigner.getNumOfTokens()).toString()).to.equal("1");
        ownershipAddress = await faroOwnershipFactory.getLastOwnership();
        faroOwnership = FaroOwnership.attach(ownershipAddress);
        expect(await faroOwnership.getAgreementURI()).to.equal(TOKEN_URI);
    });

});