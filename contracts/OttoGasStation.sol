// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external returns (bool);
}

/**
 * @title OttoGasStation
 * @notice Multisender + sponsor tx (EOA-friendly)
 */
contract OttoGasStation {
    error NotAuthorized();
    error InvalidArrayLength();
    error TransferFailed();

    event SponsorDeposit(address indexed sponsor, uint256 amount);
    event SponsorWithdraw(address indexed to, uint256 amount);
    event TokenSent(
        address indexed token,
        address indexed from,
        address indexed to,
        uint256 amount
    );

    address public owner;
    mapping(address => bool) public executors;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }

    modifier onlyExecutor() {
        if (!executors[msg.sender]) revert NotAuthorized();
        _;
    }

    constructor(address _owner) {
        owner = _owner;
    }

    function setExecutor(address executor, bool allowed)
        external
        onlyOwner
    {
        executors[executor] = allowed;
    }

    function withdrawETH(address payable to, uint256 amount)
        external
        onlyOwner
    {
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit SponsorWithdraw(to, amount);
    }

    receive() external payable {
        emit SponsorDeposit(msg.sender, msg.value);
    }

    function multisendERC20(
        address token,
        address from,
        address[] calldata to,
        uint256[] calldata amounts
    ) external onlyExecutor {
        if (to.length != amounts.length) {
            revert InvalidArrayLength();
        }

        for (uint256 i = 0; i < to.length; i++) {
            bool ok = IERC20(token).transferFrom(
                from,
                to[i],
                amounts[i]
            );
            if (!ok) revert TransferFailed();

            emit TokenSent(token, from, to[i], amounts[i]);
        }
    }
}
