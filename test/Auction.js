const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const ONE_HOUR_IN_SECS = 60 * 60;

describe("Auction", function () {
    async function deployAuction() {
        const uri = "ipfs://abcdefghijklmnopqrstuvwxyz";

        const [owner, bidderOne, bidderTwo] = await ethers.getSigners();

        const Token = await ethers.getContractFactory("Token");
        const token = await Token.deploy();

        const NFT = await ethers.getContractFactory("NFT");
        const nft = await NFT.deploy(uri, owner.address);

        const endTime = (await time.latest()) + ONE_HOUR_IN_SECS;

        const Auction = await ethers.getContractFactory("Auction");
        const auction = await Auction.deploy(token.address, nft.address, endTime);

        await token.transfer(bidderOne.address, ethers.utils.parseEther("10000"));
        await token.transfer(bidderTwo.address, ethers.utils.parseEther("10000"));

        await nft.mintOwner(auction.address, 1);

        return {
            contracts: {
                token,
                nft,
                auction,
            },
            wallets: {
                owner,
                bidderOne,
                bidderTwo,
            },
            config: {
                endTime,
                tokensPerTick: await auction.TICK_SIZE(),
                initialBalance: ethers.utils.parseEther("10000"),
            },
        };
    }

    async function deployBrokenTokenAuction() {
        const uri = "ipfs://abcdefghijklmnopqrstuvwxyz";

        const [owner] = await ethers.getSigners();

        const Token = await ethers.getContractFactory("FailingToken");
        const token = await Token.deploy();

        const NFT = await ethers.getContractFactory("NFT");
        const nft = await NFT.deploy(uri, owner.address);

        const endTime = (await time.latest()) + ONE_HOUR_IN_SECS;

        const Auction = await ethers.getContractFactory("Auction");
        const auction = await Auction.deploy(token.address, nft.address, endTime);

        return {
            contracts: {
                token,
                auction,
            },
            config: {
                tokensPerTick: await auction.TICK_SIZE(),
            },
        };
    }

    describe("Deployment", function () {
        it("Should set the tokenContract", async function () {
            const { contracts } = await loadFixture(deployAuction);

            expect(await contracts.auction.tokenContract()).to.equal(contracts.token.address);
        });

        it("Should set the rewardContract", async function () {
            const { contracts } = await loadFixture(deployAuction);

            expect(await contracts.auction.rewardContract()).to.equal(contracts.nft.address);
        });

        it("Should set the endTimestamp", async function () {
            const { contracts, config } = await loadFixture(deployAuction);
            const data = await contracts.auction.auctionData();
            expect(data.endTimestamp).to.equal(config.endTime);
        });
    });

    describe("bid", function () {
        it("Should set the auction data", async function () {
            const { contracts, wallets, config } = await loadFixture(deployAuction);

            await contracts.token.increaseAllowance(contracts.auction.address, config.tokensPerTick);
            await contracts.auction.bid(1);
            const data = await contracts.auction.auctionData();

            expect(data.winner).to.equal(wallets.owner.address);
            expect(data.ticks).to.equal(1);
            expect(data.endTimestamp).to.equal(config.endTime);
            expect(await contracts.auction.winnerAmount()).to.equal(config.tokensPerTick);
        });

        it("Should allow a higher bid", async function () {
            const { contracts, wallets, config } = await loadFixture(deployAuction);

            await contracts.token
                .connect(wallets.bidderOne)
                .increaseAllowance(contracts.auction.address, config.tokensPerTick);
            await contracts.token
                .connect(wallets.bidderTwo)
                .increaseAllowance(contracts.auction.address, config.tokensPerTick.mul(2));

            await contracts.auction.connect(wallets.bidderOne).bid(1);
            await contracts.auction.connect(wallets.bidderTwo).bid(2);

            const data = await contracts.auction.auctionData();

            expect(data.winner).to.equal(wallets.bidderTwo.address);
            expect(data.ticks).to.equal(2);
            expect(data.endTimestamp).to.equal(config.endTime);

            expect(await contracts.token.balanceOf(wallets.bidderOne.address)).to.equal(config.initialBalance);
        });

        it("Should emit the NewHighestBid event", async function () {
            const { contracts, wallets, config } = await loadFixture(deployAuction);

            await contracts.token.increaseAllowance(contracts.auction.address, config.tokensPerTick);
            await expect(contracts.auction.bid(1))
                .to.emit(contracts.auction, "NewHighestBid")
                .withArgs(wallets.owner.address, config.tokensPerTick);
        });

        it("Should extend the time if the bid is made in the threshold", async function () {
            const { contracts, config } = await loadFixture(deployAuction);

            const extension = await contracts.auction.TIME_EXTENSION();

            await contracts.token.increaseAllowance(contracts.auction.address, config.tokensPerTick);
            await time.increaseTo(config.endTime - extension);
            await contracts.auction.bid(1);

            const data = await contracts.auction.auctionData();
            expect(data.endTimestamp).to.equal(extension.add(config.endTime));
        });

        it("Should revert when closed", async function () {
            const { contracts, config } = await loadFixture(deployAuction);

            await contracts.token.increaseAllowance(contracts.auction.address, config.tokensPerTick);
            await time.increaseTo(config.endTime);

            await expect(contracts.auction.bid(1)).to.be.revertedWithCustomError(contracts.auction, "AuctionClosed");
        });

        it("Should revert if the bid is too low", async function () {
            const { contracts, config } = await loadFixture(deployAuction);

            await contracts.token.increaseAllowance(contracts.auction.address, config.tokensPerTick);

            await expect(contracts.auction.bid(0)).to.be.revertedWithCustomError(contracts.auction, "BidTooLow");
        });

        it("Should revert if the caller has insufficient balance", async function () {
            const { contracts, wallets, config } = await loadFixture(deployAuction);

            await contracts.token
                .connect(wallets.bidderOne)
                .increaseAllowance(contracts.auction.address, config.tokensPerTick.mul(100));

            await expect(contracts.auction.connect(wallets.bidderOne).bid(100)).to.be.revertedWith(
                "ERC20: transfer amount exceeds balance"
            );
        });

        it("Should revert if the token transfer fails from caller", async function () {
            const { contracts, config } = await loadFixture(deployBrokenTokenAuction);

            await contracts.token.increaseAllowance(contracts.auction.address, config.tokensPerTick);
            await contracts.token.setTransferFromResult(false);

            await expect(contracts.auction.bid(1)).to.be.revertedWithoutReason();
        });

        it("Should revert if the token transfer fails from us", async function () {
            const { contracts, config } = await loadFixture(deployBrokenTokenAuction);

            await contracts.token.increaseAllowance(contracts.auction.address, config.tokensPerTick);
            await contracts.token.setTransferResult(false);

            await contracts.auction.bid(1);

            await expect(contracts.auction.bid(2)).to.be.revertedWithoutReason();
        });
    });

    describe("withdraw", function () {
        it("Should send the asset to the winner", async function () {
            const { contracts, wallets, config } = await loadFixture(deployAuction);

            await contracts.token
                .connect(wallets.bidderOne)
                .increaseAllowance(contracts.auction.address, config.tokensPerTick);
            await contracts.auction.connect(wallets.bidderOne).bid(1);

            await time.increaseTo(config.endTime);

            await contracts.auction.connect(wallets.bidderOne).withdraw();

            expect(await contracts.nft.balanceOf(wallets.bidderOne.address)).to.equal(1);
            expect(await contracts.nft.ownerOf(1)).to.equal(wallets.bidderOne.address);
        });

        it("Should revert while to auction is running", async function () {
            const { contracts } = await loadFixture(deployAuction);

            await expect(contracts.auction.withdraw()).to.be.revertedWithCustomError(
                contracts.auction,
                "AuctionRunning"
            );
        });

        it("Should revert when the asset has already been redeemed", async function () {
            const { contracts, wallets, config } = await loadFixture(deployAuction);

            await contracts.token
                .connect(wallets.bidderOne)
                .increaseAllowance(contracts.auction.address, config.tokensPerTick);
            await contracts.auction.connect(wallets.bidderOne).bid(1);

            await time.increaseTo(config.endTime);

            await contracts.auction.connect(wallets.bidderOne).withdraw();

            await expect(contracts.auction.connect(wallets.bidderOne).withdraw()).to.be.revertedWithCustomError(
                contracts.auction,
                "WithdrawComplete"
            );
        });
    });

    describe("withdrawContractBalance", function () {
        it("Should withdraw the balance of the contract to the address.", async function () {
            const { contracts, wallets } = await loadFixture(deployAuction);

            const initialBalance = await contracts.token.balanceOf(wallets.bidderOne.address);

            await contracts.token
                .connect(wallets.bidderOne)
                .transfer(contracts.auction.address, ethers.utils.parseEther("1000"));

            await contracts.auction.withdrawContractBalance(wallets.bidderOne.address);

            expect(await contracts.token.balanceOf(wallets.bidderOne.address)).to.equal(initialBalance);
        });

        it("Revert if the transfer fails", async function () {
            const { contracts } = await loadFixture(deployBrokenTokenAuction);

            await contracts.token.transfer(contracts.auction.address, ethers.utils.parseEther("1000"));

            await contracts.token.setTransferResult(false);

            await expect(
                contracts.auction.withdrawContractBalance(contracts.auction.address)
            ).to.be.revertedWithoutReason();
        });

        it("should only be callable as the contract owner", async function () {
            const { contracts, wallets } = await loadFixture(deployAuction);

            await expect(
                contracts.auction.connect(wallets.bidderOne).withdrawContractBalance(wallets.bidderOne.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("withdrawPrize", function () {
        it("Should withdraw the prize to the address", async function () {
            const { contracts, wallets } = await loadFixture(deployAuction);

            await contracts.auction.withdrawPrize(wallets.bidderOne.address);

            expect(await contracts.nft.balanceOf(wallets.bidderOne.address)).to.equal(1);
        });

        it("should only be callable as the contract owner", async function () {
            const { contracts, wallets } = await loadFixture(deployAuction);

            await expect(
                contracts.auction.connect(wallets.bidderOne).withdrawPrize(wallets.bidderOne.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("onERC721Received", function () {
        it("return IERC721Receiver.onERC721Received.selector", async function () {
            const { contracts, wallets } = await loadFixture(deployAuction);

            expect(
                await contracts.auction.onERC721Received(wallets.owner.address, wallets.owner.address, 0, 0)
            ).to.equal("0x150b7a02");
        });
    });
});
