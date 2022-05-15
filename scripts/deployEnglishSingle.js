const { ethers } = require("hardhat");
const timeMachine = require("ether-time-traveler");

const NAME = "FARO Journey Starting";
const SYMBOL = "FAROM";
const TOKEN_URI = "HERE";
const CONTENT_ID = 123456;
const FLOOR_PRICE = ethers.utils.parseEther("1");
const BID_INCREMENT = ethers.utils.parseEther("0.1");
const BID_PRICE_MORE_THAN_FLOOR = ethers.utils.parseEther("1.2");
const BID_PRICE_HIGH = ethers.utils.parseEther("2");
const ONE_DAY_IN_SEC = 86400; // 1 day -> 86400 seconds
const AUCTION_PERIOD = 10 * ONE_DAY_IN_SEC;
const FAST_FORWARD_PERIOD = AUCTION_PERIOD * 4;

const main = async () => {
  const accounts = await ethers.getSigners();

  const EngAuctSingle = await ethers.getContractFactory("FaroEnglishAuctionSingle");

  const single = await EngAuctSingle.deploy();
  const txReceiptSingle = await single.deployTransaction.wait();
  console.log(`FaroEnglishAuctionSingle is deployed at ${single.address}\n`);

  const nf = new Intl.NumberFormat("en-US");
  console.log(`Gas used for DEPLOYING of Eng. Auction Single: ${nf.format(txReceiptSingle.gasUsed.toNumber())}`);

  // mint some NFTs
  const FaroNFT = await ethers.getContractFactory("FaroNFT");
  const faroNFT = await FaroNFT.deploy(NAME, SYMBOL, TOKEN_URI, CONTENT_ID);
  await faroNFT.mint(accounts[0].address, 1);
  await faroNFT.approve(single.address, 1);

  // create auctions for minted NFT
  let tx;
  let txReceipt;

  tx = await single.createAuction(faroNFT.address, 1, AUCTION_PERIOD, FLOOR_PRICE, BID_INCREMENT);
  txReceipt = await tx.wait();
  console.log(`Gas used for CREATING AUCTION with Eng. Auction Single: ${nf.format(txReceipt.gasUsed.toNumber())}`);

  tx = await single.startAuction(faroNFT.address, 1);
  txReceipt = await tx.wait();
  console.log(`Gas used for STARTING AUCTION with Eng. Auction Single: ${nf.format(txReceipt.gasUsed.toNumber())}`);

  const singleBidder = single.connect(accounts[1]);
  tx = await singleBidder.bid(faroNFT.address, 1, { value: BID_PRICE_MORE_THAN_FLOOR });
  txReceipt = await tx.wait();
  console.log(`Gas used for BIDDING IN AUCTION with Eng. Auction Single: ${nf.format(txReceipt.gasUsed.toNumber())}`);

  const singleWinner = single.connect(accounts[2]);
  tx = await singleWinner.bid(faroNFT.address, 1, { value: BID_PRICE_HIGH });
  txReceipt = await tx.wait();
  // console.log(`Gas used for bidding in Auction with Eng. Auction Single: ${nf.format(txReceipt.gasUsed.toNumber())}`);

  // fast forward time
  await timeMachine.advanceTimeAndBlock(ethers.provider, FAST_FORWARD_PERIOD);

  tx = await single.endAuction(faroNFT.address, 1);
  txReceipt = await tx.wait();
  console.log(`Gas used for ENDING AUCTION with Eng. Auction Single: ${nf.format(txReceipt.gasUsed.toNumber())}`);

  tx = await singleBidder.withdraw(faroNFT.address, 1);
  txReceipt = await tx.wait();
  console.log(`Gas used for WITHDRAWING FUNDS in Eng. Auction Single: ${nf.format(txReceipt.gasUsed.toNumber())}`);

  tx = await single.withdraw(faroNFT.address, 1);
  txReceipt = await tx.wait();
  console.log(`Gas used for WITHDRAWING WINNING BID in Eng. Auction Single: ${nf.format(txReceipt.gasUsed.toNumber())}`);

  tx = await singleWinner.withdrawNFT(faroNFT.address, 1);
  txReceipt = await tx.wait();
  console.log(
    `Gas used for WITHDRAWING NFT in Auction with Eng. Auction Single: ${nf.format(txReceipt.gasUsed.toNumber())}`
  );
};

main().then();
