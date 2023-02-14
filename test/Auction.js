const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const ONE_HOUR_IN_SECS = 60 * 60;

describe("Auction", function () {
    async function deployAuction() {
        const uri = "ipfs://abcdefghijklmnopqrstuvwxyz";

        const [owner, a, b, c, d, e, f, g] = await ethers.getSigners();
        const bidders = [a, b, c, d, e, f, g];

        const Token = await ethers.getContractFactory("Token");
        const token = await Token.deploy();

        const NFT = await ethers.getContractFactory("NFT");
        const nft = await NFT.deploy(uri, owner.address);

        const endTime = (await time.latest()) + ONE_HOUR_IN_SECS;

        const Auction = await ethers.getContractFactory("Auction");
        const auction = await Auction.deploy(token.address, nft.address, endTime);

        const initialBalance = ethers.utils.parseEther("10000")

        for (let bidder of bidders) {
            await token.transfer(bidder.address, initialBalance);
            await token.connect(bidder).increaseAllowance(auction.address, initialBalance);
        }

        await token.increaseAllowance(auction.address, initialBalance)
        await nft.mintOwner(auction.address, 6);

        return {
            contracts: {
                token,
                nft,
                auction,
            },
            wallets: {
                owner,
                bidders
            },
            config: {
                endTime,
                tick: ethers.utils.parseEther("1000"),
                initialBalance,
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
            expect(await contracts.auction.endTimestamp()).to.equal(config.endTime);
        });
    });

    describe("createBid", function () {
        it("First bid", async function () {
            const { contracts, wallets, config } = await loadFixture(deployAuction);

            await contracts.auction.createBid(config.tick);

            const bidCount = await contracts.auction.bidCount();
            const data = await contracts.auction.topSix(1);

            expect(bidCount).to.equal(1);
            expect(data.owner).to.equal(wallets.owner.address);
            expect(data.bid).to.equal(config.tick);
        });

        it("Bid above", async function () {
            const { contracts, wallets, config } = await loadFixture(deployAuction);

            await contracts.auction.createBid(config.tick);
            await contracts.auction.createBid(config.tick.mul(2));

            const bidCount = await contracts.auction.bidCount();
            const data1 = await contracts.auction.topSix(1);
            const data2 = await contracts.auction.topSix(2);

            expect(bidCount).to.equal(2);
            expect(data1.owner).to.equal(wallets.owner.address);
            expect(data1.bid).to.equal(config.tick.mul(2));
            expect(data2.owner).to.equal(wallets.owner.address);
            expect(data2.bid).to.equal(config.tick);
        });

        it("Bid below", async function () {
            const { contracts, wallets, config } = await loadFixture(deployAuction);

            await contracts.auction.createBid(config.tick.mul(2));
            await contracts.auction.createBid(config.tick);

            const bidCount = await contracts.auction.bidCount();
            const data1 = await contracts.auction.topSix(1);
            const data2 = await contracts.auction.topSix(2);

            expect(bidCount).to.equal(2);
            expect(data1.owner).to.equal(wallets.owner.address);
            expect(data1.bid).to.equal(config.tick.mul(2));
            expect(data2.owner).to.equal(wallets.owner.address);
            expect(data2.bid).to.equal(config.tick);
        });

        it("Fill Bids Always More", async function () {
            const { contracts, wallets, config } = await loadFixture(deployAuction);

            for (let i = 1; i <= 6; i++) {
                await contracts.auction.connect(wallets.bidders[i]).createBid(config.tick.mul(i));
            }
            
            const bidCount = await contracts.auction.bidCount();

            expect(bidCount).to.equal(6);
            for (let i = 6; i > 0; i--) {
                const data = await contracts.auction.topSix(7-i);
                expect(data.owner).to.equal(wallets.bidders[i].address);
                expect(data.bid).to.equal(config.tick.mul(i));
            }
        });

        it("Fill Bids Always Less", async function () {
            const { contracts, wallets, config } = await loadFixture(deployAuction);

            for (let i = 6; i > 0; i--) {
                await contracts.auction.connect(wallets.bidders[i]).createBid(config.tick.mul(i));
            }
            
            const bidCount = await contracts.auction.bidCount();

            expect(bidCount).to.equal(6);
            for (let i = 6; i > 0; i--) {
                const data = await contracts.auction.topSix(7-i);
                expect(data.owner).to.equal(wallets.bidders[i].address);
                expect(data.bid).to.equal(config.tick.mul(i));
            }
        });

        it("Append High", async function () {
            const { contracts, wallets, config } = await loadFixture(deployAuction);

            for (let i = 1; i <= 6; i++) {
                await contracts.auction.connect(wallets.bidders[i]).createBid(config.tick.mul(i));
            }
            
            await contracts.auction.connect(wallets.bidders[0]).createBid(config.tick.mul(7));
            const bidCount = await contracts.auction.bidCount();

            expect(bidCount).to.equal(6);
            for (let i = 6; i > 0; i--) {
                const current = 7-i;
                const data = await contracts.auction.topSix(current);
                if(current == 1) {
                    expect(data.owner).to.equal(wallets.bidders[0].address);
                    expect(data.bid).to.equal(config.tick.mul(7));
                }
                 else {
                    expect(data.owner).to.equal(wallets.bidders[i+1].address);
                    expect(data.bid).to.equal(config.tick.mul(i+1));
                 }
            }
        });

        it("Append Middle", async function () {
            const { contracts, wallets, config } = await loadFixture(deployAuction);

            for (let i = 1; i <= 6; i++) {
                await contracts.auction.connect(wallets.bidders[i]).createBid(config.tick.mul(i));
            }
            
            await contracts.auction.connect(wallets.bidders[0]).createBid(config.tick.mul(5));
            const bidCount = await contracts.auction.bidCount();

            expect(bidCount).to.equal(6);
            for (let i = 6; i > 0; i--) {
                const current = 7-i;
                const data = await contracts.auction.topSix(current);
                if(current == 3) {
                    expect(data.owner).to.equal(wallets.bidders[0].address);
                    expect(data.bid).to.equal(config.tick.mul(5));
                }
                else if(current > 3) {
                    expect(data.owner).to.equal(wallets.bidders[i+1].address);
                    expect(data.bid).to.equal(config.tick.mul(i+1));
                }
                else {
                    expect(data.owner).to.equal(wallets.bidders[i].address);
                    expect(data.bid).to.equal(config.tick.mul(i));
                 }
            }
        });

        it("Append Bottom", async function () {
            const { contracts, wallets, config } = await loadFixture(deployAuction);

            for (let i = 1; i <= 6; i++) {
                await contracts.auction.connect(wallets.bidders[i]).createBid(config.tick.mul(i));
            }
            
            await contracts.auction.connect(wallets.bidders[0]).createBid(config.tick.mul(2));
            const bidCount = await contracts.auction.bidCount();

            expect(bidCount).to.equal(6);
            for (let i = 6; i > 0; i--) {
                const current = 7-i;
                const data = await contracts.auction.topSix(current);
                if(current == 6) {
                    expect(data.owner).to.equal(wallets.bidders[0].address);
                    expect(data.bid).to.equal(config.tick.mul(2));
                }
                 else {
                    expect(data.owner).to.equal(wallets.bidders[i].address);
                    expect(data.bid).to.equal(config.tick.mul(i));
                 }
            }
        });

        // it("Should emit the NewHighestBid event", async function () {
        //     const { contracts, wallets, config } = await loadFixture(deployAuction);

        //     await contracts.token.increaseAllowance(contracts.auction.address, config.tokensPerTick);
        //     await expect(contracts.auction.createBid(1))
        //         .to.emit(contracts.auction, "NewHighestBid")
        //         .withArgs(wallets.owner.address, config.tokensPerTick);
        // });

        // it("Should extend the time if the bid is made in the threshold", async function () {
        //     const { contracts, config } = await loadFixture(deployAuction);

        //     const extension = await contracts.auction.TIME_EXTENSION();

        //     await contracts.token.increaseAllowance(contracts.auction.address, config.tokensPerTick);
        //     await time.increaseTo(config.endTime - extension);
        //     await contracts.auction.createBid(1);

        //     const data = await contracts.auction.auctionData();
        //     expect(data.endTimestamp).to.equal(extension.add(config.endTime));
        // });

        // it("Should revert when closed", async function () {
        //     const { contracts, config } = await loadFixture(deployAuction);

        //     await contracts.token.increaseAllowance(contracts.auction.address, config.tokensPerTick);
        //     await time.increaseTo(config.endTime);

        //     await expect(contracts.auction.createBid(1)).to.be.revertedWithCustomError(contracts.auction, "AuctionClosed");
        // });

        // it("Should revert if the bid is too low", async function () {
        //     const { contracts, config } = await loadFixture(deployAuction);

        //     await contracts.token.increaseAllowance(contracts.auction.address, config.tokensPerTick);

        //     await expect(contracts.auction.createBid(0)).to.be.revertedWithCustomError(contracts.auction, "BidTooLow");
        // });

        // it("Should revert if the caller has insufficient balance", async function () {
        //     const { contracts, wallets, config } = await loadFixture(deployAuction);

        //     await contracts.token
        //         .connect(wallets.bidderOne)
        //         .increaseAllowance(contracts.auction.address, config.tokensPerTick.mul(100));

        //     await expect(contracts.auction.connect(wallets.bidderOne).createBid(100)).to.be.revertedWith(
        //         "ERC20: transfer amount exceeds balance"
        //     );
        // });

        // it("Should revert if the token transfer fails from caller", async function () {
        //     const { contracts, config } = await loadFixture(deployBrokenTokenAuction);

        //     await contracts.token.increaseAllowance(contracts.auction.address, config.tokensPerTick);
        //     await contracts.token.setTransferFromResult(false);

        //     await expect(contracts.auction.createBid(1)).to.be.revertedWithoutReason();
        // });

        // it("Should revert if the token transfer fails from us", async function () {
        //     const { contracts, config } = await loadFixture(deployBrokenTokenAuction);

        //     await contracts.token.increaseAllowance(contracts.auction.address, config.tokensPerTick);
        //     await contracts.token.setTransferResult(false);

        //     await contracts.auction.createBid(1);

        //     await expect(contracts.auction.createBid(2)).to.be.revertedWithoutReason();
        // });
    });

    describe("withdrawContractBalance", function () {
        it("Should withdraw the balance of the contract to the address.", async function () {
            const { contracts, wallets } = await loadFixture(deployAuction);

            const initialBalance = await contracts.token.balanceOf(wallets.bidders[0].address);

            await contracts.token
                .connect(wallets.bidders[0])
                .transfer(contracts.auction.address, ethers.utils.parseEther("1000"));

            await contracts.auction.withdrawContractBalance(wallets.bidders[0].address);

            expect(await contracts.token.balanceOf(wallets.bidders[0].address)).to.equal(initialBalance);
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
                contracts.auction.connect(wallets.bidders[0]).withdrawContractBalance(wallets.bidders[0].address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("withdrawPrize", function () {
        it("Should withdraw the prize to the address", async function () {
            const { contracts, wallets } = await loadFixture(deployAuction);

            await contracts.auction.withdrawPrize(wallets.bidders[0].address, 1);

            expect(await contracts.nft.balanceOf(wallets.bidders[0].address)).to.equal(1);
            expect(await contracts.nft.ownerOf(1)).to.equal(wallets.bidders[0].address);
        });

        it("should only be callable as the contract owner", async function () {
            const { contracts, wallets } = await loadFixture(deployAuction);

            await expect(
                contracts.auction.connect(wallets.bidders[0]).withdrawPrize(wallets.bidders[0].address, 1)
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
