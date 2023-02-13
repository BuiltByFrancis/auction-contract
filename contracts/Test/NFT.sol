// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "erc721a/contracts/extensions/ERC721AQueryable.sol";
import "erc721a/contracts/extensions/ERC721ABurnable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "closedsea/src/OperatorFilterer.sol";

contract NFT is
    ERC721AQueryable,
    ERC721ABurnable,
    OperatorFilterer,
    Ownable,
    ERC2981
{
    error IncorrectAmountError();
    error IncorrectSaleStageError();
    error ExceedsMaxSupplyError();
    error ExceedsWalletSupplyError();
    error InvalidProofError();

    string public baseURI;

    bool public operatorFilteringEnabled;

    constructor(string memory uri, address payable royaltiesReceiver)
        ERC721A("Absolute Art M8", "BOZO")
    {
        _registerForOperatorFiltering();
        operatorFilteringEnabled = true;

        baseURI = uri;

        _setDefaultRoyalty(royaltiesReceiver, 1000);
    }

    // #######################################################################################
    // #                                                                                     #
    // #                                      Accessors                                      #
    // #                                                                                     #
    // #######################################################################################

    function setBaseURI(string memory uri) external onlyOwner {
        baseURI = uri;
    }

    function withdraw(address payable _to, uint256 amount) external onlyOwner {
        if (address(this).balance < amount || amount == 0)
            revert IncorrectAmountError();

        _to.transfer(amount);
    }

    function withdrawAll(address payable _to) external onlyOwner {
        _to.transfer(address(this).balance);
    }

    // #######################################################################################
    // #                                                                                     #
    // #                                       Minting                                       #
    // #                                                                                     #
    // #######################################################################################

    function mintOwner(address _to, uint256 _amount) external onlyOwner {
        _mint(_to, _amount);
    }

    // #######################################################################################
    // #                                                                                     #
    // #                                  OperatorFilterer                                   #
    // #                                                                                     #
    // #######################################################################################

    function setApprovalForAll(address operator, bool approved)
        public
        override(IERC721A, ERC721A)
        onlyAllowedOperatorApproval(operator)
    {
        super.setApprovalForAll(operator, approved);
    }

    function approve(address operator, uint256 tokenId)
        public
        payable
        override(IERC721A, ERC721A)
        onlyAllowedOperatorApproval(operator)
    {
        super.approve(operator, tokenId);
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public payable override(IERC721A, ERC721A) onlyAllowedOperator(from) {
        super.transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public payable override(IERC721A, ERC721A) onlyAllowedOperator(from) {
        super.safeTransferFrom(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public payable override(IERC721A, ERC721A) onlyAllowedOperator(from) {
        super.safeTransferFrom(from, to, tokenId, data);
    }

    function setOperatorFilteringEnabled(bool value) public onlyOwner {
        operatorFilteringEnabled = value;
    }

    function _operatorFilteringEnabled() internal view override returns (bool) {
        return operatorFilteringEnabled;
    }

    function _isPriorityOperator(address operator)
        internal
        pure
        override
        returns (bool)
    {
        // OpenSea Seaport Conduit:
        // https://etherscan.io/address/0x1E0049783F008A0085193E00003D00cd54003c71
        // https://goerli.etherscan.io/address/0x1E0049783F008A0085193E00003D00cd54003c71
        return operator == address(0x1E0049783F008A0085193E00003D00cd54003c71);
    }

    // #######################################################################################
    // #                                                                                     #
    // #                                       ERC2981                                       #
    // #                                                                                     #
    // #######################################################################################

    function setDefaultRoyalty(address payable receiver, uint96 numerator)
        public
        onlyOwner
    {
        _setDefaultRoyalty(receiver, numerator);
    }

    // #######################################################################################
    // #                                                                                     #
    // #                                       ERC721AA                                       #
    // #                                                                                     #
    // #######################################################################################

    function _startTokenId() internal view virtual override returns (uint256) {
        return 1;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    // #######################################################################################
    // #                                                                                     #
    // #                                       ERC165                                        #
    // #                                                                                     #
    // #######################################################################################

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(IERC721A, ERC721A, ERC2981)
        returns (bool)
    {
        return
            ERC721A.supportsInterface(interfaceId) ||
            ERC2981.supportsInterface(interfaceId);
    }
}
