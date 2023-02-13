// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FailingToken is ERC20 {
    uint8 private _decimals;
    uint256 public constant maxTotalSupply = 160000000000000000000000000;

    bool public transferResult = true;
    bool public transferFromResult = true;

    constructor() ERC20("Reward Token", "RT") {
        _mint(msg.sender, maxTotalSupply);
    }

    function setTransferResult(bool _transferResult) external {
        transferResult = _transferResult;
    }

    function setTransferFromResult(bool _transferFromResult) external {
        transferFromResult = _transferFromResult;
    }

    function transfer(address, uint256) public virtual override returns (bool) {
        return transferResult;
    }

    function transferFrom(
        address,
        address,
        uint256
    ) public virtual override returns (bool) {
        return transferFromResult;
    }
}
