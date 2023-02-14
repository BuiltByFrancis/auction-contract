// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Auction is Ownable, IERC721Receiver {
    error WithdrawComplete();
    error AuctionRunning();
    error AuctionClosed();
    error BidTooLow();

    event LeaderboardShuffled();

    struct AuctionData {
        address owner;
        uint96 bid;
    }

    uint64 public endTimestamp;
    uint64 public timeExtension;
    uint96 public minBid;
    uint32 public bidCount;

    // TODO: Clean up above, check for struct savings, add owner functions to edit

    IERC20 public immutable tokenContract;
    IERC721 public immutable rewardContract;

    mapping(uint256 => AuctionData) public topSix;

    constructor(
        IERC20 _tokenContract,
        IERC721 _rewardContact,
        uint64 _endTimestamp
    ) {
        tokenContract = _tokenContract;
        rewardContract = _rewardContact;

        endTimestamp = _endTimestamp;
    }

    // TODO: probs refactor, maybe
    function createBid(uint96 _bid) external {
        AuctionData memory data = topSix[6];

        if (block.timestamp >= endTimestamp) revert AuctionClosed();

        if (_bid <= data.bid || _bid - data.bid < minBid) revert BidTooLow();
        if (!tokenContract.transferFrom(msg.sender, address(this), _bid))
            revert();

        if (!(data.owner == address(0) || tokenContract.transfer(data.owner, data.bid))) revert();

        if (endTimestamp - block.timestamp <= timeExtension) {
            unchecked {
                endTimestamp += timeExtension;
            }
        }

        uint32 _bidCount = bidCount;
        if (_bidCount < 6) {
            unchecked {
                ++_bidCount;
            }
            bidCount = _bidCount;
        }

        data.owner = msg.sender;
        data.bid = _bid;
     
        for (; _bidCount > 1;) {
            AuctionData memory _data = topSix[_bidCount - 1];

            if (data.bid <= _data.bid) {
                break;
            }

            topSix[_bidCount] = _data;

            unchecked {
                --_bidCount;
            }
        }

        topSix[_bidCount] = data;

        emit LeaderboardShuffled();
    }

    // TODO: Write this
    function increaseBid(uint96 _bid) external {
        // Search backward to find bidder
        // When found increase
        // Keep searching until new spot
        // Shuffle down along the way
        // Revert if we get to top and sender is not present

        // Questions: Different min change?
    }

    // TODO: Write this
    function withdraw() external {
        // if (block.timestamp < endTimestamp) revert AuctionRunning();
        // if (rewardContract.balanceOf(address(this)) == 0)
        //     revert WithdrawComplete();

        // rewardContract.transferFrom(address(this), topSix[1].owner, 1);
        // rewardContract.transferFrom(address(this), topSix[2].owner, 2);
        // rewardContract.transferFrom(address(this), topSix[3].owner, 3);
        // rewardContract.transferFrom(address(this), topSix[4].owner, 4);
        // rewardContract.transferFrom(address(this), topSix[5].owner, 5);
        // rewardContract.transferFrom(address(this), topSix[6].owner, 6);
    }

    function withdrawContractBalance(address to) external onlyOwner {
        uint256 balance = tokenContract.balanceOf(address(this));
        if (!tokenContract.transfer(to, balance)) revert();
    }

    function withdrawPrize(address to, uint256 id) external onlyOwner {
        rewardContract.transferFrom(address(this), to, id);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
