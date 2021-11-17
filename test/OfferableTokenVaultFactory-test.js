
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');


const NAME = "KTLO Journey Starting";
const SYMBOL = "KTLOM";
const TOKEN_URI = "HERE";
const LIST_PRICE = 5;
const PARTICIPANTS_NUM = 100;


describe('OfferableTokenVaultFactory', function () {

    before(async function () {
        const accounts = await ethers.provider.listAccounts();
        this.owner = accounts[0];
        this.user = accounts[2];
        this.user2 = accounts[3];
        this.projectFundRaisingSigner = await ethers.getSigner(this.user);
        this.ownerSigner = await ethers.getSigner(this.owner);
        this.distributor = await ethers.getSigner(this.user2);

        this.supply = 10000000;


        let distributeEtherTx;

        let participantWallet;
        let participantAddress;

        this.offeringParticipants = [];
        this.funderAddresses = [];
        this.allocations = [];


        const fairAlloc = Math.floor(this.supply / PARTICIPANTS_NUM);

        for (let i = 0; i < PARTICIPANTS_NUM; i++) {
            participantWallet = ethers.Wallet.createRandom();
            participantAddress = participantWallet.getAddress();
            this.offeringParticipants.push(participantWallet);
            this.funderAddresses.push(participantAddress);
            this.allocations.push(fairAlloc);
            distributeEtherTx = this.distributor.sendTransaction({
                to: participantAddress,
                value: ethers.utils.parseEther(1)
            });
        }

        this.supply = PARTICIPANTS_NUM * fairAlloc;

        const KtlOwnershipToken = await ethers.getContractFactory('OfferableERC721TokenVault');
        this.ktlOwnershipToken = await KtlOwnershipToken.deploy(NAME, SYMBOL, TOKEN_URI);
        await this.ktlOwnershipToken.deployed();

        const erc721ContractWithSigner = this.ktlOwnershipToken.connect(this.ownerSigner);
        const mintTx = await this.ktlOwnershipToken.mint(this.user);
        await mintTx.wait();

        const ERCVaultFactory = await ethers.getContractFactory('OfferableERC721VaultFactory');
        this.ercVaultFactory = await ERCVaultFactory.deploy();
        await this.ercVaultFactory.deployed();

        const tokenVaultFactoryAddress = this.ercVaultFactory.address;

        const approveTx = await erc721ContractWithSigner.setApprovalForAll(tokenVaultFactoryAddress, true);
        await approveTx.wait();

        this.contractWithSigner = this.ercVaultFactory.connect(this.ownerSigner);

    });

    it('Can deploy offering contract successfully', async function () {
        const tx = await contractWithSigner.mint(this.ktlOwnershipToken.address, this.user, this.owner,
            this.supply, LIST_PRICE, NAME, SYMBOL, this.funderAddresses, this.allocations);
        await tx.wait();
        expect(await this.contractWithSigner.getNumOfTokens()).to.equal(1);
        const offeringAddress = await this.contractWithSigner.getVault(0);
        const OfferingVault = await ethers.getContractFactory('OfferableERC721TokenVault');
        const offeringVault = await OfferingVault.attach(offeringAddress);
        const ownerSigner = offeringVault.connect(this.owner);
        expect(await ownerSigner.getOfferingState()).to.equal(0);
    });
});