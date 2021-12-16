const { expect } = require("chai");
const { ethers } = require("hardhat");
const { expectRevert } = require("@openzeppelin/test-helpers");

const NAME = "FARO Journey Starting";
const SYMBOL = "FAROM";
const TOKEN_URI = "HERE";
const LIST_PRICE = 5;
const LIST_PRICE_AS_ETH = ethers.utils.parseEther("5");
const LISTING_PERIOD = 30;

const ACCOUNTS_NUM = 20;
const PARTICIPANTS_NUM = 17;
const BUY_AMOUNT = 10;
const SUPPLY = 1000;

const priceChanges = [10.0, 9.942404, 9.88514, 9.828206, 9.7716, 9.715319, 9.659363, 9.603729, 9.548416, 9.493421,
    9.438743, 9.38438, 9.33033, 9.276591, 9.223162, 9.17004, 9.117225, 9.064714, 9.012505, 8.960596, 8.908987,
    8.857675, 8.806659, 8.755936, 8.705506, 8.655366, 8.605514, 8.55595, 8.506672, 8.457677, 8.408964, 8.360532,
    8.312379, 8.264503, 8.216903, 8.169577, 8.122524, 8.075742, 8.029229, 7.982984, 7.937005, 7.891291, 7.845841,
    7.800652, 7.755724, 7.711054, 7.666642, 7.622485, 7.578583, 7.534933, 7.491535, 7.448387, 7.405488, 7.362835,
    7.320428, 7.278266, 7.236346, 7.194668, 7.15323, 7.11203, 7.071068, 7.030341, 6.98985, 6.949591, 6.909564,
    6.869768, 6.830201, 6.790862, 6.75175, 6.712863, 6.674199, 6.635759, 6.59754, 6.559541, 6.52176, 6.484198,
    6.446852, 6.40972, 6.372803, 6.336098, 6.299605, 6.263322, 6.227248, 6.191382, 6.155722, 6.120268, 6.085018,
    6.04997, 6.015125, 5.980481, 5.946036, 5.911789, 5.87774, 5.843886, 5.810228, 5.776763, 5.743492, 5.710412,
    5.677522, 5.644822, 5.61231, 5.579986, 5.547847, 5.515894, 5.484125, 5.452539, 5.421134, 5.389911, 5.358867,
    5.328003, 5.297315, 5.266805, 5.236471, 5.206311, 5.176325, 5.146511, 5.116869, 5.087398, 5.058097, 5.028965]


describe("DutchAuction", function () {
    before(async function () {
        await ethers.provider.send("hardhat_reset");
        const accounts = await ethers.provider.listAccounts();
        this.owner = accounts[0];
        this.user = accounts[1];
        this.user2 = accounts[2];
        this.ownerSigner = await ethers.getSigner(this.owner);
        this.projectFundRaisingSigner = await ethers.getSigner(this.user);
        this.distributor = await ethers.getSigner(this.user2);

        this.supply = 1000;

        let participantWallet;
        let participantAddress;

        this.offeringParticipants = [];
        this.funderAddresses = [];
        this.allocations = [];

        this.fairAlloc = Math.floor(this.supply / PARTICIPANTS_NUM);

        for (let i = 3; i < ACCOUNTS_NUM; i++) {
            participantAddress = accounts[i];
            participantWallet = await ethers.getSigner(participantAddress);
            this.offeringParticipants.push(participantWallet);
            this.funderAddresses.push(participantAddress);
            this.allocations.push(this.fairAlloc);
        }
        this.supply = PARTICIPANTS_NUM * this.fairAlloc;

        const FarownershipToken = await ethers.getContractFactory("Farownership");
        this.farownershipToken = await FarownershipToken.deploy(
            NAME,
            SYMBOL,
            TOKEN_URI
        );
        await this.farownershipToken.deployed();

        const ownershipTokenAddress = this.farownershipToken.address;

        const erc721ContractWithSigner = this.farownershipToken.connect(
            this.ownerSigner
        );
        const mintTx = await erc721ContractWithSigner.mint(this.user);
        await mintTx.wait();

        const ERCVaultFactory = await ethers.getContractFactory(
            "OfferableERC721VaultFactory"
        );
        this.ercVaultFactory = await ERCVaultFactory.deploy();
        await this.ercVaultFactory.deployed();
        const tokenVaultFactoryAddress = this.ercVaultFactory.address;

        const erc721RecipientSigner = this.farownershipToken.connect(
            this.projectFundRaisingSigner
        );
        const approveTx = await erc721RecipientSigner.approve(
            tokenVaultFactoryAddress,
            1
        );
        await approveTx.wait();

        this.factoryWithSigner = this.ercVaultFactory.connect(this.ownerSigner);

        const tx = await this.factoryWithSigner.mint(
            ownershipTokenAddress,
            this.user,
            this.user,
            this.supply,
            LIST_PRICE_AS_ETH,
            LISTING_PERIOD,
            NAME,
            SYMBOL,
            this.funderAddresses,
            this.allocations
        );
        await tx.wait();
        this.offeringAddress = await this.factoryWithSigner.getVault(0);
        this.OfferingVault = await ethers.getContractFactory(
            "FaroOwnership"
        );
        this.offeringVault = await this.OfferingVault.attach(this.offeringAddress);
        this.ownerWithOffering = this.offeringVault.connect(
            this.projectFundRaisingSigner
        );
        this.nonownerWithOffering = this.offeringVault.connect(this.distributor);
        this.participantSigner = this.offeringVault.connect(
            this.offeringParticipants[0]
        );

        this.participantSigner.end();

        const DutchAuctionFactory = await ethers.getContractFactory(
            "DutchAuctionFactory"
        );
        this.dutchAuctionFactory = await DutchAuctionFactory.deploy();
        await this.dutchAuctionFactory.deployed();
        this.dutchAuctionFactoryWithSigner = this.dutchAuctionFactory.connect(this.ownerSigner);
        const ethPriceChanges = []
        for (let i = 0; i < priceChanges.length; i++) {
            ethPriceChanges.push(ethers.utils.parseEther(priceChanges[i].toString()));
        }
        const auctionCreationTx = await this.dutchAuctionFactoryWithSigner.createAuction(this.offeringAddress,
            ethPriceChanges, SUPPLY, this.funderAddresses);
        auctionCreationTx.wait();

        this.dutchAuctionAddress = await this.dutchAuctionFactoryWithSigner.getLastAuction();
        this.DutchAuction = await ethers.getContractFactory(
            "FaroOwnership"
        );
        this.dutchAuction = await this.DutchAuction.attach(this.offeringAddress);
        this.ownerWithAuction= this.dutchAuction.connect(
            this.projectFundRaisingSigner
        );
        this.nonownerWithAuction = this.dutchAuction.connect(this.distributor);
        this.participantSigner = this.dutchAuction.connect(
            this.offeringParticipants[0]
        );
    });
