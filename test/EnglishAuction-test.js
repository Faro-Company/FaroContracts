
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { expectRevert } = require('@openzeppelin/test-helpers');


const NAME = "KTLO Journey Starting";
const SYMBOL = "KTLOM";
const TOKEN_URI = "HERE";
const FLOOR_PRICE = 5;
const AUCTION_PERIOD = 600;
const BID_INCREMENT = 1;

const CONTENT_ID = 123456;

const ACCOUNTS_NUM = 20;
const PARTICIPANTS_NUM = 17;
const DOLLAR_DISTRIBUTE_AMOUNT = 10000000000;
const SAMPLE_TOKEN_ID = 1

describe('OfferableERC721TokenVault', function () {

    before(async function () {
        const accounts = await ethers.provider.listAccounts();
        this.owner = accounts[0];
        this.user = accounts[1];
        this.user2 = accounts[2];
        this.ownerSigner = await ethers.getSigner(this.owner);
        this.nftHolder = await ethers.getSigner(this.user);
        this.distributor = await ethers.getSigner(this.user2);

        this.supply = 10000000;

        let distributeEtherTx;

        let participantWallet;
        let participantAddress;

        this.offeringParticipants = [];
    this.funderAddresses = [];
        this.allocations = [];

        const USDCMock = await ethers.getContractFactory('USDCMock');
        this.usdcMock = await USDCMock.deploy();
        await this.usdcMock.deployed();

        let usdcApproveTx = await this.usdcMock.approve(this.user2, DOLLAR_DISTRIBUTE_AMOUNT * PARTICIPANTS_NUM);
        await usdcApproveTx.wait();

        let usdcSigner = this.usdcMock.connect(this.distributor);
        let usdcTransferTx;

        this.fairAlloc = Math.floor(this.supply / PARTICIPANTS_NUM);

        for (let i = 3; i < ACCOUNTS_NUM; i++) {
            participantAddress = accounts[i];
            participantWallet = await ethers.getSigner(participantAddress);
            this.offeringParticipants.push(participantWallet);
            this.funderAddresses.push(participantAddress);
            this.allocations.push(this.fairAlloc);
            distributeEtherTx = this.distributor.sendTransaction({
                to: participantAddress,
                value: ethers.utils.parseEther("1")
            });
            usdcTransferTx = await usdcSigner.transferFrom(this.owner, participantAddress, DOLLAR_DISTRIBUTE_AMOUNT);
            await usdcTransferTx.wait();
        }

        const KtlNFT = await ethers.getContractFactory('KTLNFT');
        this.ktlNFT = await KtlNFT.deploy(NAME, SYMBOL, TOKEN_URI, CONTENT_ID);
        await this.ktlNFT.deployed();
        const erc721ContractWithSigner = this.ktlNFT.connect(this.ownerSigner);

        const EnglishAuctionFactory = await ethers.getContractFactory('EnglishAuctionFactory');
        this.englishAuctionFactory = await EnglishAuctionFactory.deploy();
        await this.englishAuctionFactory.deployed();
        const englishAuctionFactoryAddress = this.englishAuctionFactory.address;

        let wallet;
        let signer;
        this.signers = [];
        this.wallets = [];

        for (let i = 3; i < ACCOUNTS_NUM; i++) {
            const mintTx = await erc721ContractWithSigner.mint(accounts[i], i);
            await mintTx.wait();
            wallet = await ethers.getSigner(accounts[i]);
            this.wallets.push(wallet);
            signer = this.ktlNFT.connect(wallet)
            let approveTx = signer.approve(englishAuctionFactoryAddress, i);
            await approveTx.wait();
            signer = this.englishAuctionFactory.connect(wallet);
            this.signers.push(signer);
        }

        this.signer = signer;
        this.nonownerWithAuction = this.englishAuctionFactory.connect(this.distributor);
        this.ownerWithAuction = this.englishAuctionFactory.connect(this.nftHolder);

    });

    it('Auction cannot be created by non-owner', async function () {
        await expectRevert(this.nonownerWithOffering.createAuction(BID_INCREMENT, AUCTION_PERIOD, this.ktlNFT.address,
            SAMPLE_TOKEN_ID, FLOOR_PRICE), 'Only owner can perform this operation.');
    });

    it('Auction cannot be created by owner of different tokenID', async function () {
        await expectRevert(this.signers[0].createAuction(BID_INCREMENT, AUCTION_PERIOD, this.ktlNFT.address,
            SAMPLE_TOKEN_ID, FLOOR_PRICE), 'Only owner can perform this operation.');
    });

    it('Auction can be created by owners', async function () {
        let participantSigner, tx;
        for (let i = 0; i < this.signers.length; i++) {
            participantSigner = this.signers[i];
            tx = await participantSigner.createAuction(BID_INCREMENT, AUCTION_PERIOD, this.ktlNFT.address,
                i, FLOOR_PRICE);
            await tx.wait();
            expect((await participantSigner.getAuctionCount()).toString()).to.equal(i.toString());
        }
    });

    it('Auction cannot be started by nonOwner', async function () {
        const lastAuction = await participantSigner.getLastAuction();
        const EnglishAuction = await ethers.getContractFactory('EnglishAuction');
        const englishAuction = await EnglishAuction.attach(lastAuction);
        const participantSigner = englishAuction.connect(this.wallets[0]);
        await expectRevert(participantSigner.start(), 'Only owner can perform this operation.');
    });

    it('Cannot bid on non-started auction', async function() {
        const lastAuction = await participantSigner.getLastAuction();
        const EnglishAuction = await ethers.getContractFactory('EnglishAuction');
        const englishAuction = await EnglishAuction.attach(lastAuction);
        const participantSigner = englishAuction.connect(this.wallets[0]);
        await expectRevert(participantSigner.bid(), 'Auction state not live.');
    });

});